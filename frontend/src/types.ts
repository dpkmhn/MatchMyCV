// Mirrors app/schemas.py (OptimizationReport and its parts) as serialized by FastAPI.

export type Importance = "must_have" | "nice_to_have";
export type MatchStatus = "met" | "partial" | "missing";

export interface Role {
  title: string;
  company: string;
  dates: string | null;
  bullets: string[];
}

export interface ResumeProfile {
  name: string | null;
  headline: string | null;
  contact: string[];
  summary: string | null;
  years_experience: number | null;
  skills: string[];
  roles: Role[];
  education: string[];
  certifications: string[];
  projects: string[];
}

export interface Requirement {
  text: string;
  category: "skill" | "experience" | "education" | "certification" | "domain" | "soft_skill";
  importance: Importance;
  keywords: string[];
}

export interface JobRequirements {
  title: string;
  company: string | null;
  seniority: "intern" | "junior" | "mid" | "senior" | "lead" | "principal" | "unknown";
  requirements: Requirement[];
  responsibilities: string[];
}

export interface RequirementMatch {
  requirement: string;
  status: MatchStatus;
  evidence: string | null;
  note: string;
}

export interface MatchAnalysis {
  matches: RequirementMatch[];
  strengths: string[];
}

export interface MatchScore {
  overall: number;
  must_have: number;
  nice_to_have: number;
  keyword_coverage: number;
  matched_keywords: string[];
  missing_keywords: string[];
}

export interface BulletRewrite {
  original: string;
  rewritten: string;
  keywords_added: string[];
  reason: string;
}

export interface GapAdvice {
  requirement: string;
  advice: string;
}

export interface OptimizationPlan {
  tailored_summary: string;
  bullet_rewrites: BulletRewrite[];
  skills_to_highlight: string[];
  keywords_to_add: string[];
  gap_advice: GapAdvice[];
  ats_tips: string[];
}

export interface GuardIssue {
  kind: "unknown_original" | "unsupported_keyword" | "missing_skill_claimed";
  detail: string;
}

export interface OptimizationReport {
  resume: ResumeProfile;
  job: JobRequirements;
  analysis: MatchAnalysis;
  score: MatchScore;
  plan: OptimizationPlan;
  guard_issues: GuardIssue[];
  revisions: number;
  cv: TailoredCV | null;
}

export interface CVRole {
  title: string;
  company: string;
  dates: string | null;
  bullets: string[];
}

export interface TailoredCV {
  name: string;
  headline: string | null;
  contact: string[];
  summary: string;
  skills: string[];
  experience: CVRole[];
  projects: string[];
  education: string[];
  certifications: string[];
}

export interface CVState {
  id: string;
  cv: TailoredCV;
  history: { note: string; at: string }[];
  change_summary?: string;
  warnings?: string[];
}

export type NodeName =
  | "parse_resume"
  | "parse_job"
  | "match"
  | "score"
  | "optimize"
  | "guard"
  | "finalize";

export type StreamEvent =
  | { event: "step"; node: NodeName; label: string }
  | { event: "result"; report: OptimizationReport; markdown: string; cv_id: string | null }
  | { event: "error"; message: string };

export interface StepEvent {
  node: NodeName;
  label: string;
  at: number;
}
