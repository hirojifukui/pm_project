import pino, { type LoggerOptions } from "pino";

// PII を伏せるロガー。憲法 IV（個人情報の露出禁止）、FR-019、SC-008 に対応。
// 禁止値: 氏名、社員番号、金額、出張先、口座情報、領収書関連。
// アプリ内のログからは、申請番号（applicationNumber）などの内部識別子だけが残る。

const baseOptions: LoggerOptions = {
  level: process.env.LOG_LEVEL ?? "info",
  redact: {
    paths: [
      "name",
      "empNo",
      "amount",
      "amountYen",
      "totalAmountYen",
      "destination",
      "account",
      "accountNumber",
      "receipt",
      "receipts",
      "address",
      "*.name",
      "*.empNo",
      "*.amount",
      "*.amountYen",
      "*.totalAmountYen",
      "*.destination",
      "*.account",
      "*.accountNumber",
      "*.receipt",
      "*.receipts",
      "*.address",
      "req.body.name",
      "req.body.empNo",
      "req.body.amount",
      "req.body.destination",
      "req.body.account",
      "req.body.accountNumber",
    ],
    censor: "[REDACTED]",
    remove: false,
  },
};

const options: LoggerOptions =
  process.env.NODE_ENV === "development"
    ? {
        ...baseOptions,
        transport: { target: "pino-pretty", options: { colorize: true } },
      }
    : baseOptions;

export const logger = pino(options);
export type Logger = typeof logger;
