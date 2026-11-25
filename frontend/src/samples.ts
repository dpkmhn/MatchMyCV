/**
 * Random test data: builds a fictional resume and job description from small pools.
 * The resume's role family matches the job most of the time, so fit scores vary from strong to weak.
 */

interface Family {
  title: string;
  jobTitles: string[];
  core: string[];
  extra: string[];
  bullets: string[];
  duties: string[];
  project: string[];
}

const FAMILIES: Family[] = [
  {
    title: "Backend Engineer",
    jobTitles: ["Backend Engineer", "Senior Backend Engineer", "Python Developer"],
    core: ["Python", "FastAPI", "PostgreSQL", "Redis", "Docker", "REST APIs", "Git"],
    extra: ["Celery", "Kafka", "gRPC", "AWS (EC2, S3, Lambda)", "Kubernetes", "SQLAlchemy", "pytest"],
    bullets: [
      "Built REST APIs in FastAPI for a payments platform used by {n} merchant partners.",
      "Moved nightly batch jobs from cron scripts to Celery workers, cutting failed runs from ~{n} a month to 2.",
      "Added Redis caching to the reporting API, reducing average response time from 1.{d}s to {n}0ms.",
      "Designed the PostgreSQL schema for the order service and wrote the migration plan.",
      "Wrote integration tests with pytest that raised coverage of the billing module to {p}%.",
      "Split a monolithic Django app into {d} services behind an API gateway.",
    ],
    duties: [
      "Design and build scalable backend services in Python",
      "Own the data model and performance of PostgreSQL databases",
      "Build and maintain public and internal REST APIs",
      "Improve reliability through testing, monitoring and on-call ownership",
    ],
    project: ["QueueLite: a tiny Redis-backed task queue with retries and dead-letter handling."],
  },
  {
    title: "AI Engineer",
    jobTitles: ["AI Engineer (LLM Applications)", "Machine Learning Engineer", "Applied AI Engineer"],
    core: ["Python", "LangChain", "LangGraph", "OpenAI API", "RAG", "FastAPI", "Pydantic"],
    extra: ["pgvector", "FAISS", "Pinecone", "LangSmith", "Hugging Face", "PyTorch", "Docker"],
    bullets: [
      "Built a RAG assistant over {n},000 policy documents using LangChain and pgvector.",
      "Created an evaluation set of {n}0 questions and tracked answer accuracy on every release.",
      "Shipped an agent with LangGraph that drafts claim summaries, saving reviewers ~{d} hours a week.",
      "Cut LLM cost per request by {p}% by caching embeddings and routing simple queries to a smaller model.",
      "Exposed model features through FastAPI endpoints with structured outputs validated by Pydantic.",
      "Fine-tuned a small classifier with Hugging Face to triage {n}0k support tickets.",
    ],
    duties: [
      "Build agentic workflows that call tools and external APIs",
      "Design retrieval-augmented generation (RAG) pipelines over large document collections",
      "Build evaluation sets and monitor quality, latency and cost of LLM features",
      "Ship AI features to production behind well-designed Python APIs",
    ],
    project: ["PaperChat: a small RAG demo that answers questions about PDFs using LangChain and FAISS."],
  },
  {
    title: "Frontend Engineer",
    jobTitles: ["Frontend Engineer", "Senior React Developer", "UI Engineer"],
    core: ["TypeScript", "React", "HTML", "CSS", "Tailwind CSS", "Vite", "Git"],
    extra: ["Next.js", "Redux", "React Query", "Playwright", "Storybook", "Figma", "GraphQL"],
    bullets: [
      "Rebuilt the checkout flow in React and TypeScript, lifting conversion by {d}.{d}%.",
      "Set up a Storybook component library adopted by {d} product teams.",
      "Reduced bundle size by {p}% with route-level code splitting in Vite.",
      "Wrote Playwright end-to-end tests covering the {n} most-used user journeys.",
      "Fixed accessibility issues found in an audit, reaching WCAG AA on all core pages.",
      "Migrated data fetching to React Query, removing ~{n}00 lines of custom cache code.",
    ],
    duties: [
      "Build fast, accessible interfaces in React and TypeScript",
      "Own our design system together with the design team",
      "Improve web performance and Core Web Vitals",
      "Write automated tests for critical user journeys",
    ],
    project: ["Palette: an open-source colour-contrast checker built with React and Vite."],
  },
  {
    title: "Data Engineer",
    jobTitles: ["Data Engineer", "Senior Data Engineer", "Analytics Engineer"],
    core: ["Python", "SQL", "Apache Spark", "Airflow", "dbt", "Snowflake", "Pandas"],
    extra: ["Kafka", "BigQuery", "AWS Glue", "Terraform", "Great Expectations", "Docker", "Databricks"],
    bullets: [
      "Wrote Python ETL jobs with Pandas to load vendor CSV files into Snowflake.",
      "Built {n} Airflow DAGs that feed the finance and growth dashboards.",
      "Rewrote a slow Spark job, cutting runtime from {d} hours to {n} minutes.",
      "Introduced dbt models and tests, replacing {n} hand-maintained SQL scripts.",
      "Added data-quality checks with Great Expectations that catch ~{d} bad loads a month.",
      "Streamed clickstream events through Kafka into BigQuery for near-real-time reporting.",
    ],
    duties: [
      "Build and maintain batch and streaming data pipelines",
      "Model data in the warehouse for analysts and data scientists",
      "Own data quality, lineage and pipeline monitoring",
      "Optimise cost and performance of the data platform",
    ],
    project: ["TrailLog: a dbt + DuckDB project that analyses public bike-share trip data."],
  },
  {
    title: "DevOps Engineer",
    jobTitles: ["DevOps Engineer", "Site Reliability Engineer", "Platform Engineer"],
    core: ["Linux", "Docker", "Kubernetes", "Terraform", "AWS", "GitHub Actions", "Bash"],
    extra: ["Prometheus", "Grafana", "Helm", "Ansible", "Python", "ArgoCD", "GCP"],
    bullets: [
      "Moved {n} services from VMs to Kubernetes using Helm charts.",
      "Wrote Terraform modules for VPCs, databases and IAM used across {d} AWS accounts.",
      "Set up GitHub Actions pipelines for tests and Docker image builds.",
      "Built Prometheus and Grafana dashboards and alerting, cutting mean time to recovery by {p}%.",
      "Reduced the monthly cloud bill by {p}% through right-sizing and spot instances.",
      "Ran the on-call rotation and wrote runbooks for the {n} most common incidents.",
    ],
    duties: [
      "Run and scale our Kubernetes platform on AWS",
      "Manage infrastructure as code with Terraform",
      "Own CI/CD pipelines and developer tooling",
      "Improve observability, alerting and incident response",
    ],
    project: ["kubepeek: a small CLI that summarises pod health across clusters."],
  },
];

const FIRST = ["Alex", "Priya", "Jordan", "Sam", "Neha", "Rahul", "Maya", "Chris", "Ananya", "Leo", "Fatima", "Arjun"];
const LAST = ["Rivera", "Sharma", "Chen", "Patel", "Okafor", "Nair", "Kim", "Fernandes", "Iyer", "Novak", "Mehta", "Silva"];
const CITIES = ["Bengaluru, India", "Pune, India", "Hyderabad, India", "Chennai, India", "Berlin, Germany", "London, UK", "Toronto, Canada"];
const EMPLOYERS = ["Finlytics Pvt Ltd", "DataNest Solutions", "Cartwheel Commerce", "Bluepine Health", "Orbit Logistics", "Quillsoft", "Tandem Insurance", "Lumen Media"];
const HIRERS = ["Northwind Labs", "Acme Analytics", "Brightpath AI", "Helio Systems", "Kestrel Fintech", "Saffron Health", "Mosaic Retail"];
const DOMAINS = ["insurance", "fintech", "healthcare", "e-commerce", "logistics", "media"];
const SCHOOLS = ["VIT Vellore", "NIT Trichy", "Manipal Institute of Technology", "University of Pune", "Anna University"];
const DEGREES = ["B.Tech in Computer Science", "B.E. in Information Technology", "B.Sc in Computer Science", "M.Tech in Software Engineering"];
const MODES = ["Hybrid", "Remote", "On-site"];
const SOFT = [
  "Mentored two interns on code review and testing practices.",
  "Worked with product managers to turn vague requests into scoped tickets.",
  "Responsible for fixing bugs reported by customer support.",
  "Presented a monthly tech talk to the engineering team.",
];

const rand = (n: number) => Math.floor(Math.random() * n);
const pick = <T,>(xs: readonly T[]): T => xs[rand(xs.length)];
const shuffle = <T,>(xs: readonly T[]): T[] => {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const take = <T,>(xs: readonly T[], n: number) => shuffle(xs).slice(0, n);
const fill = (s: string) =>
  s
    .replace(/\{n\}/g, () => String(2 + rand(48)))
    .replace(/\{d\}/g, () => String(2 + rand(7)))
    .replace(/\{p\}/g, () => String(15 + rand(50)));

function makeResume(f: Family, years: number): string {
  const first = pick(FIRST);
  const last = pick(LAST);
  const now = new Date().getFullYear();
  const [jobA, jobB] = take(EMPLOYERS, 2);
  const split = Math.max(1, Math.round(years * 0.6));
  const startA = now - split;
  const startB = now - years;
  const skills = [...take(f.core, 5 + rand(3)), ...take(f.extra, 2 + rand(3))];
  const bullets = shuffle(f.bullets).map(fill);
  const title = years >= 6 ? `Senior ${f.title}` : f.title;

  return `${first.toUpperCase()} ${last.toUpperCase()}
${title} | ${pick(CITIES)} | ${first.toLowerCase()}.${last.toLowerCase()}@example.com

SUMMARY
${f.title} with ${years} years of experience in ${pick(DOMAINS)} and ${pick(DOMAINS)} products.
Enjoys working on reliable systems and learning from the people who use them.

SKILLS
${skills.join(", ")}

EXPERIENCE
${f.title} — ${jobA}                                    Jun ${startA} - Present
${bullets.slice(0, 3).map((b) => `- ${b}`).join("\n")}
- ${pick(SOFT)}

${years >= 6 ? "" : "Junior "}${f.title} — ${jobB}                                    Jul ${startB} - May ${startA}
${bullets.slice(3, 5).map((b) => `- ${b}`).join("\n")}

PROJECTS
- ${pick(f.project)}

EDUCATION
${pick(DEGREES)}, ${pick(SCHOOLS)}, ${startB}
`;
}

function makeJob(f: Family, years: number): string {
  const company = pick(HIRERS);
  const domain = pick(DOMAINS);
  const required = take(f.core, 5);
  const nice = take(f.extra, 3);

  return `${pick(f.jobTitles)} — ${company}, ${pick(CITIES).split(",")[0]} (${pick(MODES)})

About the role
${company} builds software for ${domain} companies. You will design, build and ship features end to end,
from first prototype to production, in a small team that owns its work.

What you'll do
${shuffle(f.duties).map((d) => `- ${d}`).join("\n")}
- Work with product and domain experts to turn fuzzy requirements into reliable systems

Requirements
- ${years}+ years of professional experience as a ${f.title.toLowerCase()}
${required.map((s) => `- Hands-on experience with ${s}`).join("\n")}
- Clear written communication and ownership of your work

Nice to have
${nice.map((s) => `- Experience with ${s}`).join("\n")}
- Prior work in ${domain}
`;
}

/** A fresh, random resume + job description pair. */
export function randomSample(): { resume: string; job: string } {
  const jobFamily = pick(FAMILIES);
  // ~65% same field (strong fit), otherwise a neighbouring field (partial / weak fit).
  const cvFamily = Math.random() < 0.65 ? jobFamily : pick(FAMILIES);
  const jobYears = 2 + rand(5);
  const cvYears = Math.max(1, jobYears + rand(5) - 2);
  return { resume: makeResume(cvFamily, cvYears), job: makeJob(jobFamily, jobYears) };
}
