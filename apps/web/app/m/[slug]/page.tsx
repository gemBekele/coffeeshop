import { fetchMenu } from "@/lib/api";

export default async function MenuPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const menu = await fetchMenu(slug);

  if (!menu) {
    return (
      <main className="mx-auto max-w-2xl p-8">
        <h1 className="text-2xl font-semibold">Menu unavailable</h1>
        <p className="mt-2 text-[var(--muted)]">
          We couldn&apos;t load the menu for &ldquo;{slug}&rdquo;. Please ask a
          staff member for assistance.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold">{menu.shop.name}</h1>
        <p className="text-[var(--muted)]">Menu &middot; {menu.shop.currency}</p>
      </header>

      <div className="flex flex-col gap-8">
        {menu.categories.map((category) => (
          <section key={category.id}>
            <h2 className="mb-3 text-xl font-medium">{category.name}</h2>
            <ul className="flex flex-col gap-3">
              {category.products.map((product) => (
                <li
                  key={product.id}
                  className="flex items-start justify-between gap-4 border-b border-black/5 pb-3"
                >
                  <div>
                    <p className="font-medium">{product.name}</p>
                    {product.description ? (
                      <p className="text-sm text-[var(--muted)]">
                        {product.description}
                      </p>
                    ) : null}
                  </div>
                  <span className="whitespace-nowrap font-medium">
                    {menu.shop.currency} {product.price.toFixed(2)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  );
}
