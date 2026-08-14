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
