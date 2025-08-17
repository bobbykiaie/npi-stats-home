import { LogLevel } from "@azure/msal-browser";

export const msalConfig = {
  auth: {
    clientId: import.meta.env.VITE_MS_CLIENT_ID,
    authority: `https://login.microsoftonline.com/1687bd89-8f00-4ac4-8a85-fff50aefa6c5`,
    redirectUri: "https://ashy-moss-0cf69b40f.6.azurestaticapps.net"
  },
  cache: {
    cacheLocation: "sessionStorage",
    storeAuthStateInCookie: false,
  },
  system: {
    loggerOptions: {
      loggerCallback: (level, message, containsPii) => {
        if (containsPii) return;
        switch (level) {
          case LogLevel.Error: console.error(message); return;
          case LogLevel.Warning: console.warn(message); return;
          // You can uncomment the next line for more detailed MSAL logs
          // case LogLevel.Verbose: console.debug(message); return;
        }
      },
    },
  },
};

// Scopes you add here will be prompted for consent
export const loginRequest = {
  scopes: ["User.Read"]
};
