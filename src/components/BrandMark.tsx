import Image from "next/image";
export default function BrandMark() {
  return (
    <span className="brand-mark">
      <Image
        src="/gamefi/favicon/android-icon-192x192.png"
        width={52}
        height={52}
        alt=""
      />
      <span className="brand-type">
        <strong>NMFP</strong>
        <small>Need Money for Porsche</small>
      </span>
    </span>
  );
}
