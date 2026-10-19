// Vitest 共通セットアップ。
// タイムゾーンを `Asia/Tokyo` に固定し、憲法「追加の制約」を満たす。
// SQLite の切替は本プロジェクトでは行わず、Prisma を使うテストはモック/スタブで扱う。

process.env.TZ = "Asia/Tokyo";
