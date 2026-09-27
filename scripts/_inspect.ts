import { q } from "../src/lib/db";
(async () => {
  const jobs = await q("select region_code, status, detail from job_runs order by id");
  for (const j of jobs as any[]) console.log(j.region_code, j.status, JSON.stringify(j.detail));
  const hs = await q(`select s.region_code, s.category, c.admin_name, count(*)::int n, round(max(gi_z)::numeric,1) z, sum(request_count_90d)::int reqs, sum(case when is_emerging then 1 else 0 end)::int em
    from cell_scores s join h3_cells c using(region_code,h3_cell) where is_hotspot group by 1,2,3 having count(*)>=2 order by 1, 4 desc`);
  console.table(hs);
  const recs = await q(`select region_code, rank, title, round(priority_score::numeric,1) score, people_affected_est ppl, request_count req, hotspot_cells hs, funded_overlap f from recommendations where is_active and rank<=6 order by region_code, rank`);
  console.table(recs);
  const cl = await q(`select region_code, count(*)::int clusters, round(avg(request_count)::numeric,2) avg_size, max(request_count) maxsize from clusters group by 1`);
  console.table(cl);
  const em = await q(`select s.region_code, s.category, c.admin_name, count(*)::int from cell_scores s join h3_cells c using(region_code,h3_cell) where is_emerging group by 1,2,3 order by 4 desc limit 15`);
  console.table(em);
  process.exit(0);
})();
