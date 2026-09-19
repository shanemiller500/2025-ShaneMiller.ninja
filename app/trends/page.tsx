import TrendsClient from "./TrendsClient";

export const metadata = {
  title: "Trends | ShaneMiller.ninja",
  description: "A one-stop shop for worldwide internet trends and searchable topics.",
};

export default function TrendsPage() {
  return (
    <main className="min-h-[calc(100vh-64px)] px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-brand-900 dark:text-white sm:text-3xl">
            Internet Trends
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-brand-600 dark:text-brand-400">
            A one-stop dashboard for what is popping worldwide: Google Trends, world topics,
            social buzz, popular videos, and keyword search.
          </p>
        </div>

        <TrendsClient />
      </div>
    </main>
  );
}

