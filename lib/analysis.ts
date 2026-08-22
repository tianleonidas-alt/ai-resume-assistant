export type InterviewItem = {
  question: string;
  answer: string;
};

export type ResumeSuggestion = {
  priority: "高" | "中" | "低";
  title: string;
  original: string;
  suggested: string;
};

export type AnalysisResult = {
  score: number;
  summary: string;
  insightTitle: string;
  insight: string;
  strengths: string[];
  gaps: string[];
  suggestions: ResumeSuggestion[];
  coverLetter: string;
  interviewQuestions: InterviewItem[];
};

const standaloneDateLine = /^(?:日期\s*[：:]\s*)?(?:(?:19|20)\d{2}\s*[年./-]\s*)?\d{1,2}\s*(?:月|[./-])\s*\d{1,2}\s*(?:日)?\s*$/;
const referencePrefix = /^(?:参考(?:回答|答案|要点)?|回答(?:要点)?|答)[：:\s]*/i;

/** Remove model-added labels so the UI owns the visual "参考：" prefix. */
export function normalizeInterviewAnswer(answer: string) {
  return answer.trim().replace(referencePrefix, "").trim();
}

/**
 * Dates belong to the task metadata, rather than model prose. Removing only
 * standalone date lines preserves legitimate dates in the body of a letter.
 */
export function normalizeCoverLetter(coverLetter: string) {
  return coverLetter
    .split("\n")
    .filter((line) => !standaloneDateLine.test(line.trim()))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asBoundedScore(value: unknown, fallback: number): number {
  const score = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function asStringArray(value: unknown, maxItems: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean)
    .slice(0, maxItems);
}

export function normalizeAnalysisResult(result: Partial<AnalysisResult>): AnalysisResult {
  const raw = (result ?? {}) as unknown as Record<string, unknown>;

  const suggestionsRaw = Array.isArray(raw.suggestions) ? raw.suggestions : [];
  const suggestions: ResumeSuggestion[] = suggestionsRaw
    .map((item) => {
      if (item === null || typeof item !== "object") return null;
      const entry = item as Record<string, unknown>;
      const title = asString(entry.title, "待补充");
      const original = asString(entry.original, "待补充");
      const suggested = asString(entry.suggested, "待补充");
      if (!title && !original && !suggested) return null;
      const priority = entry.priority === "高" || entry.priority === "低" ? entry.priority : "中";
      return { priority, title, original, suggested };
    })
    .filter((item): item is ResumeSuggestion => item !== null)
    .slice(0, 5);

  const questionsRaw = Array.isArray(raw.interviewQuestions)
    ? raw.interviewQuestions
    : Array.isArray(raw.interview_questions)
      ? raw.interview_questions
      : Array.isArray(raw.questions)
        ? raw.questions
        : [];
  const interviewQuestions: InterviewItem[] = questionsRaw
    .map((item) => {
      if (item === null || typeof item !== "object") return null;
      const entry = item as Record<string, unknown>;
      const question = asString(entry.question, "待补充");
      const answer = asString(entry.answer, "待补充");
      if (!question && !answer) return null;
      return { question, answer: normalizeInterviewAnswer(answer) };
    })
    .filter((item): item is InterviewItem => item !== null)
    .slice(0, 10);

  return {
    score: asBoundedScore(raw.score, 60),
    summary: asString(raw.summary, "岗位匹配度分析已生成，请结合报告具体内容查看。"),
    insightTitle: asString(raw.insightTitle, "核心洞察"),
    insight: asString(raw.insight, "根据简历与岗位描述生成了匹配分析，信息不足处请结合实际情况补充。"),
    strengths: asStringArray(raw.strengths, 5),
    gaps: asStringArray(raw.gaps, 4),
    suggestions,
    coverLetter: normalizeCoverLetter(asString(raw.coverLetter, "")),
    interviewQuestions,
  };
}

export function titleFromJobDescription(jobDescription: string) {
  const firstLine = jobDescription.split("\n").map((line) => line.trim()).find(Boolean) || "目标岗位";
  return firstLine.split(/[｜|—–-]/)[0].trim().slice(0, 120) || "目标岗位";
}

export function formatChinaDate(value: string | Date) {
  const parts = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(new Date(value));
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || "";
  return `${read("year")} 年 ${read("month")} 月 ${read("day")} 日`;
}

export function formatCoverLetterForCopy(coverLetter: string, generatedAt: string | Date) {
  return `${normalizeCoverLetter(coverLetter)}\n\n${formatChinaDate(generatedAt)}`;
}

export const demoResult: AnalysisResult = {
  score: 78,
  summary: "已经具备扎实基础，重点是让增长成果更有说服力。",
  insightTitle: "经验是对的，叙事还可以更聚焦。",
  insight: "你在用户研究、产品迭代和跨团队推进上拥有可靠的实践积累。下一步应将零散的“做过什么”，收束为围绕增长目标的完整案例，突出你如何定义问题、做出取舍并带来结果。",
  strengths: ["用户洞察", "产品规划", "跨团队协作", "项目推进"],
  gaps: ["增长指标表达", "商业化经验"],
  suggestions: [
    { priority: "高", title: "把项目描述换成增长结果", original: "负责会员中心改版，完成需求梳理与上线。", suggested: "主导会员中心改版，以 12 场用户访谈验证核心路径；上线三个月，会员激活率提升 18%。" },
    { priority: "高", title: "补齐商业判断的证据", original: "参与订阅产品的功能规划。", suggested: "结合付费漏斗与流失访谈规划订阅功能优先级，使试用转付费率提升 9%。" },
    { priority: "中", title: "让协作角色更具体", original: "协同研发、设计团队推进项目。", suggested: "协调 2 个研发小组与设计、运营共 12 人，拆解里程碑并按期交付关键版本。" }
  ],
  coverLetter: "致招聘团队：\n\n看到贵司正在寻找一位能够连接用户需求与增长目标的产品经理，我非常期待加入。过去三年，我持续负责面向 C 端用户的产品迭代：从用户访谈中识别关键阻塞点，到与设计、研发和运营共同定义方案，再以数据复盘验证真实影响。\n\n在最近的会员中心改版中，我主导完成 12 场用户访谈和核心链路重构，上线后三个月会员激活率提升 18%。这段经历让我更确信：优秀的产品工作不是堆叠功能，而是把模糊的问题转化为可验证、可推进、可复盘的增长机会。\n\n贵司高级产品经理岗位对用户洞察、商业目标和跨团队协作的要求，与我的工作方式高度契合。我期待把这份以用户为起点、以结果为终点的习惯带入团队。感谢阅读，期待进一步交流。\n\n此致\n林知夏",
  interviewQuestions: [
    { question: "你如何判断一个需求是否值得做？", answer: "先验证用户问题与业务目标，再用影响范围、实现成本和时效性排序。" },
    { question: "说一个你推动增长的完整案例。", answer: "用“问题—假设—实验—结果”讲会员激活率提升的项目。" },
    { question: "数据与用户反馈相矛盾时怎么办？", answer: "拆分人群和场景，回到样本质量，再设计小范围验证实验。" },
    { question: "如何处理跨团队的优先级冲突？", answer: "把分歧从“观点”转成共同目标和量化的取舍依据。" },
    { question: "一次没有达到预期的上线经历？", answer: "诚实说明假设偏差，并突出复盘后如何改进指标与节奏。" },
    { question: "你如何理解这个岗位的核心指标？", answer: "从北极星指标拆到获客、激活、留存与商业化关键链路。" },
    { question: "怎样让用户研究真正影响决策？", answer: "把洞察沉淀为可验证的假设，并明确其对应的决策点。" },
    { question: "面对信息不完整的需求如何推进？", answer: "先明确不可逆决策与最低验证成本，用小步试验降低不确定性。" },
    { question: "你会如何规划入职后的前 30 天？", answer: "理解业务、走查核心链路、访谈关键角色，并锁定一个高价值问题。" },
    { question: "如何衡量一次产品迭代是否成功？", answer: "同时看目标指标、用户行为变化和长期副作用，不只看单点数字。" }
  ]
};
