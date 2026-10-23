export function BrandLogo({
  className = "h-6 w-auto",
  alt = "Mahindra",
}: {
  className?: string;
  alt?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/mahindra-logo.png" alt={alt} className={className} />
  );
}
