import Link from "next/link";
import { ja } from "@/i18n/ja";

export default function Home() {
  return (
    <main className="max-w-3xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-3">{ja.app.title}</h1>
      <p className="text-sm text-gray-700 mb-6">{ja.app.description}</p>
      <ul className="space-y-2">
        <li>
          <Link
            className="text-blue-700 underline"
            href="/login"
          >
            {ja.nav.login}
          </Link>
        </li>
      </ul>
    </main>
  );
}
