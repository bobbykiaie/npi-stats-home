BEGIN TRANSACTION;
CREATE TABLE IF NOT EXISTS "active_builds" (
	"build_id"	INTEGER,
	"username"	TEXT NOT NULL UNIQUE,
	"lot_number"	TEXT NOT NULL,
	"config_number"	TEXT NOT NULL,
	"mp_number"	TEXT NOT NULL,
	"start_time"	TEXT DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY("build_id" AUTOINCREMENT),
	FOREIGN KEY("mp_number") REFERENCES "manufacturing_procedures"("mp_number"),
	FOREIGN KEY("username") REFERENCES "users"("username") ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS "build_records" (
	"br_number"	TEXT,
	"config_number"	TEXT NOT NULL UNIQUE,
	PRIMARY KEY("br_number"),
	FOREIGN KEY("config_number") REFERENCES "configurations"("config_number") ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS "config_mp_specs" (
	"config_number"	TEXT NOT NULL,
	"mp_number"	TEXT NOT NULL,
	"spec_name"	TEXT NOT NULL,
	"type"	TEXT NOT NULL CHECK("type" IN ('Variable', 'Attribute')),
	"upper_spec"	REAL DEFAULT NULL,
	"lower_spec"	REAL DEFAULT NULL,
	"nominal"	REAL DEFAULT NULL,
	"attribute_value"	TEXT DEFAULT NULL,
	PRIMARY KEY("config_number","mp_number","spec_name"),
	FOREIGN KEY("config_number") REFERENCES "configurations"("config_number") ON DELETE CASCADE,
	FOREIGN KEY("mp_number") REFERENCES "manufacturing_procedures"("mp_number") ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS "configurations" (
	"config_number"	TEXT,
	"mvd_number"	TEXT NOT NULL,
	PRIMARY KEY("config_number"),
	FOREIGN KEY("mvd_number") REFERENCES "products"("mvd_number") ON DELETE CASCADE,
	FOREIGN KEY("mvd_number") REFERENCES "products"("mvd_number")
);
CREATE TABLE IF NOT EXISTS "engineering_builds" (
	"ys_number"	TEXT,
	"created_at"	TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY("ys_number")
);
CREATE TABLE IF NOT EXISTS "inspection_logs" (
	"log_id"	INTEGER,
	"username"	TEXT NOT NULL,
	"lot_number"	TEXT NOT NULL,
	"config_number"	TEXT NOT NULL,
	"mp_number"	TEXT NOT NULL,
	"spec_name"	TEXT NOT NULL,
	"inspection_type"	TEXT NOT NULL CHECK("inspection_type" IN ('Variable', 'Attribute')),
	"unit_number"	INTEGER NOT NULL,
	"inspection_value"	REAL DEFAULT NULL,
	"pass_fail"	TEXT DEFAULT NULL CHECK("pass_fail" IN ('Pass', 'Fail')),
	"timestamp"	TEXT DEFAULT CURRENT_TIMESTAMP,
	PRIMARY KEY("log_id" AUTOINCREMENT),
	FOREIGN KEY("config_number","mp_number","spec_name") REFERENCES "config_mp_specs"("config_number","mp_number","spec_name") ON DELETE CASCADE,
	FOREIGN KEY("lot_number") REFERENCES "lots"("lot_number") ON DELETE CASCADE,
	FOREIGN KEY("username") REFERENCES "users"("username") ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS "lots" (
	"lot_number"	TEXT,
	"ys_number"	TEXT,
	"config_number"	TEXT NOT NULL,
	"quantity"	INTEGER NOT NULL DEFAULT 0,
	"description"	TEXT DEFAULT NULL,
	PRIMARY KEY("lot_number"),
	FOREIGN KEY("config_number") REFERENCES "configurations"("config_number") ON DELETE CASCADE,
	FOREIGN KEY("ys_number") REFERENCES "engineering_builds"("ys_number") ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS "manufacturing_procedures" (
	"mp_number"	TEXT,
	"procedure_name"	TEXT NOT NULL UNIQUE,
	PRIMARY KEY("mp_number")
);
CREATE TABLE IF NOT EXISTS "products" (
	"mvd_number"	TEXT,
	"product_name"	TEXT NOT NULL UNIQUE,
	PRIMARY KEY("mvd_number")
);
CREATE TABLE IF NOT EXISTS "users" (
	"user_id"	INTEGER,
	"username"	TEXT NOT NULL UNIQUE,
	"password"	TEXT NOT NULL,
	"role"	TEXT NOT NULL CHECK("role" IN ('operator', 'engineer', 'supervisor')),
	PRIMARY KEY("user_id" AUTOINCREMENT)
);
COMMIT;
