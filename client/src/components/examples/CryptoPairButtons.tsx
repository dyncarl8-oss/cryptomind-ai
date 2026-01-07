import { CryptoPairButtons } from "../CryptoPairButtons";

export default function CryptoPairButtonsExample() {
  const handleSelect = (pair: string) => {
    console.log("Selected crypto pair:", pair);
  };

  return (
    <div className="p-4 bg-background">
      <CryptoPairButtons onSelect={handleSelect} />
    </div>
  );
}
