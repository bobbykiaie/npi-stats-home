import express from 'express';
import { AzureOpenAI } from 'openai';
import { prisma } from '../config/db.js';
import { protectRoute } from '../middleware/authMiddleware.js';
import fs from 'fs/promises';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();

// ——— Azure OpenAI Client Setup ———
const endpoint   = process.env.AZURE_OPENAI_ENDPOINT;
const apiKey     = process.env.AZURE_OPENAI_API_KEY;
const deployment = process.env.AZURE_OPENAI_DEPLOYMENT_NAME;
const apiVersion = process.env.AZURE_OPENAI_API_VERSION;

if (!endpoint || !apiKey || !deployment || !apiVersion) {
  console.error('⚠️ Missing Azure OpenAI environment variables');
}

const client = new AzureOpenAI({ endpoint, apiKey, deployment, apiVersion });

// ——— Build your Prisma findMany functions automatically ———
const findManyFunctions = Object.keys(prisma)
  .filter((k) => typeof prisma[k]?.findMany === 'function')
  .map((model) => ({
    name:       `findManyOn${model}`,
    description:`Fetch rows from the ${model} table`,
    parameters: {
      type: 'object',
      properties: {
        where:   { type: 'object' },
        select:  { type: 'object' },
        orderBy: { type: 'object' },
        take:    { type: 'integer' },
        skip:    { type: 'integer' },
      },
      required: []
    }
  }));

// ——— Add analytic functions ———
const analyticFunctions = [
  {
    name:        'calculateCpk',
    description: 'Compute Cpk for every variable spec in a given active build',
    parameters: {
      type: 'object',
      properties: {
        buildId: {
          type: 'integer',
          description: 'The activeBuilds.build_id to analyze'
        }
      },
      required: ['buildId']
    }
  },
  {
    name:        'calculateYield',
    description: 'Compute yield (pass‐rate) per user across all inspection logs',
    parameters: {
      type: 'object',
      properties: {},
      required: []
    }
  }
];

const functions = [...findManyFunctions, ...analyticFunctions];

// Helper: load your Prisma schema for context
async function getPrismaSchema() {
  const schemaPath = path.join(process.cwd(), 'prisma/schema.prisma');
  return fs.readFile(schemaPath, 'utf-8');
}

router.post('/chat', protectRoute(['engineer']), async (req, res) => {
  const { history, message } = req.body;
  if (!message) return res.status(400).json({ error: 'A message is required.' });

  // Rebuild the conversation
  const system = {
    role: 'system',
    content: 'You are FormaAI, a manufacturing data assistant. Use function-calling to fetch or compute exactly what the user requests.'
  };
  const userMsg = { role: 'user', content: message };
  const convo = [system, ...(history||[]), userMsg];

  try {
    // 1) Ask the LLM what to do
    const first = await client.chat.completions.create({
      model: deployment,
      messages: [
        {
          role: 'system',
          content: [
            'You are NPI Stats, a manufacturing data assistant.',
            'When you receive the user’s question, respond by calling exactly one function.',
            'Do NOT return any text—only the function_call JSON object.',
            '',
            'Available functions:',
            ...functions.map(f => `- ${f.name}: ${f.description}`)
          ].join('\n')
        },
        ...convo.slice(1),
        userMsg
      ],
      functions,
      function_call: 'auto',
      max_tokens: 1024,
      temperature: 0
    });

    const choice = first.choices[0].message;

    // 2) If no function was called, return the content directly
    if (!choice.function_call) {
      return res.json({ reply: choice.content, history: [...convo, choice] });
    }

    // 3) Parse & run the function
    const { name, arguments: argsJson } = choice.function_call;
    const args = JSON.parse(argsJson || '{}');
    let fnResult;

    if (name.startsWith('findManyOn')) {
      const model = name.replace('findManyOn', '');
      fnResult = await prisma[model].findMany(args);

    } else if (name === 'calculateCpk') {
      const { buildId } = args;
      const build = await prisma.activeBuilds.findUnique({
        where: { build_id: buildId }
      });
      if (!build) {
        fnResult = { error: `No active build found with ID ${buildId}` };
      } else {
        const { lot_number, config_number, mp_number } = build;
        const specs = await prisma.configMpSpecs.findMany({
          where: { config_number, mp_number, type: 'variable' }
        });
        fnResult = await Promise.all(
          specs.map(async (spec) => {
            const logs = await prisma.inspectionLogs.findMany({
              where: {
                lot_number,
                config_number,
                mp_number,
                spec_name: spec.spec_name,
                inspection_value: { not: null }
              },
              select: { inspection_value: true }
            });
            const vals = logs.map(l => l.inspection_value);
            if (vals.length < 2) {
              return { spec: spec.spec_name, cpk: null, reason: 'Not enough data' };
            }
            const mean = vals.reduce((a,b) => a + b, 0) / vals.length;
            const sd = Math.sqrt(vals.reduce((a,b) => a + (b-mean)**2, 0) / vals.length);
            const usl = spec.upper_spec, lsl = spec.lower_spec;
            const cpk = Math.min((usl-mean)/(3*sd), (mean-lsl)/(3*sd));
            return { spec: spec.spec_name, cpk };
          })
        );
      }

    } else if (name === 'calculateYield') {
      const logs = await prisma.inspectionLogs.findMany({
        select: { username: true, pass_fail: true }
      });
      const stats = {};
      logs.forEach(l => {
        stats[l.username] ??= { pass:0, total:0 };
        stats[l.username].total++;
        if (l.pass_fail.toLowerCase()==='pass') stats[l.username].pass++;
      });
      fnResult = Object.entries(stats).map(([user,s]) => ({
        user,
        yield: (s.pass/s.total)*100
      }));
    }

    // 4) Send the function result back and get a final summary
    const followup = await client.chat.completions.create({
      model: deployment,
      messages: [
        ...convo,
        choice,
        { role: 'function', name, content: JSON.stringify(fnResult) },
        {
          role: 'system',
          content: 'Now summarize for the user in markdown, based ONLY on the JSON above.'
        }
      ],
      max_tokens: 512,
      temperature: 0.7
    });

    const replyMsg = followup.choices[0].message;
    const newHistory = [
      ...convo,
      choice,
      { role: 'function', name, content: JSON.stringify(fnResult) },
      replyMsg
    ];
    return res.json({ reply: replyMsg.content, history: newHistory });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'AI assistant error.' });
  }
});

export default router;
