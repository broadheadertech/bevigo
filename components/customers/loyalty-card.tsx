"use client";

type LoyaltyCardProps = {
 stampsEarned: number;
 stampsRequired: number;
 compact?: boolean;
};

export function LoyaltyCard({
 stampsEarned,
 stampsRequired,
 compact = false,
}: LoyaltyCardProps) {
 const isFull = stampsEarned >= stampsRequired;
 const stamps = Array.from({ length: stampsRequired }, (_: unknown, i: number) => i);

 if (compact) {
 return (
 <div className="flex items-center gap-2">
 <div className="flex gap-1">
 {stamps.map((i: number) => (
 <div
 key={i}
 className={`w-3 h-3 rounded-full border transition-all duration-300 ${
 i < stampsEarned
 ?"bg-amber-500 border-amber-600 shadow-lg"
 :"bg-stone-500/10"
 }`}
 />
 ))}
 </div>
 <span className="text-xs">
 {stampsEarned}/{stampsRequired}
 </span>
 {isFull && (
 <span className="text-xs font-medium text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
 Redeem!
 </span>
 )}
 </div>
 );
 }

 return (
 <div>
 <div className="flex items-center justify-between mb-2">
 <h4 className="text-xs font-semibold uppercase tracking-wide">
 Loyalty Card
 </h4>
 <span className="text-xs">
 {stampsEarned}/{stampsRequired} stamps
 </span>
 </div>

 <div className="grid grid-cols-5 gap-2">
 {stamps.map((i: number) => (
 <div
 key={i}
 className={`aspect-square rounded-xl flex items-center justify-center border-2 transition-all duration-300 ${
 i < stampsEarned
 ?"bg-amber-500/15 border-amber-400"
 :"bg-stone-500/10"
 }`}
 >
 {i < stampsEarned ? (
 <svg
 className="w-5 h-5 text-amber-600"
 fill="currentColor"
 viewBox="0 0 20 20"
 >
 <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
 </svg>
 ) : (
 <div className="w-3 h-3 rounded-full bg-stone-200" />
 )}
 </div>
 ))}
 </div>

 {isFull && (
 <div className="mt-3 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-xl text-center">
 <p className="text-sm font-semibold text-amber-400">
 Card Full! Ready to Redeem
 </p>
 </div>
 )}
 </div>
 );
}
