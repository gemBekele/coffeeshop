export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-3xl font-semibold">Coffee House</h1>
      <p className="text-[var(--muted)]">
        This is the public menu site. Scan a table QR code to view the menu.
      </p>
    </main>
  );
}
