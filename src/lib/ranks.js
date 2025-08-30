export const RANKS = [
  { title: "Recruit", min: 0 },
  { title: "Cadet", min: 1000 },
  { title: "Analyst", min: 3000 },
  { title: "Field Operative", min: 7000 },
  { title: "Senior Operative", min: 12000 },
  { title: "Case Officer", min: 18000 },
  { title: "Special Agent", min: 25000 },
  { title: "Station Chief", min: 35000 },
  { title: "Director", min: 50000 }
];

export function rankFor(total){
  let current = RANKS[0];
  for (const r of RANKS){
    if (total >= r.min) current = r; else break;
  }
  return current;
}

export function groupByRank(entries){
  const buckets = {};
  for (const e of entries){
    const r = rankFor(e.total||0).title;
    (buckets[r] ||= []).push(e);
  }
  return buckets;
}
