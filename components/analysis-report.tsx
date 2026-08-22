"use client";

import type { CSSProperties } from "react";
import {
  formatChinaDate,
  formatCoverLetterForCopy,
  normalizeAnalysisResult,
  type AnalysisResult,
} from "@/lib/analysis";

type AnalysisReportProps = {
  result: AnalysisResult;
  jobTitle: string;
  generatedAt: string;
  isDemo?: boolean;
};

function Score({ score }: { score: number }) {
  const style = { "--score": `${Math.min(100, Math.max(0, score))}%` } as CSSProperties;
  return <div className="score" style={style}><div><b>{score}</b><small>/ 100</small></div></div>;
}

export function AnalysisReport({ result: rawResult, jobTitle, generatedAt, isDemo = false }: AnalysisReportProps) {
  const result = normalizeAnalysisResult(rawResult);
  const letterForCopy = formatCoverLetterForCopy(result.coverLetter, generatedAt);

  return <section className="report" id="report">
    <div className="report-top"><div><div className="section-no">02 / YOUR CAREER BRIEF</div><h2>{isDemo && <span className="sample-badge">示例报告</span>}为「{jobTitle}」准备的<br />一份更有力的表达。</h2></div><span className="date">{isDemo ? "ANALYSIS SAMPLE" : "AI ANALYSIS"} · {formatChinaDate(generatedAt)}</span></div>
    <section className="match"><div className="score-panel"><div><div className="section-no">01 / MATCH ANALYSIS</div><h3>岗位匹配度</h3><div className="score-wrap"><Score score={result.score} /><p className="score-note">{result.summary}</p></div></div><p className="score-foot">与你的目标岗位相比，核心能力项已覆盖 {Math.min(9, Math.max(1, Math.round(result.score / 11)))} / 9。</p></div><div className="match-copy"><div className="section-no">02 / WHAT WE SEE</div><h3>{result.insightTitle}</h3><p>{result.insight}</p><div className="tags">{result.strengths.map((item) => <span className="tag good" key={item}>{item}</span>)}{result.gaps.map((item) => <span className="tag gap" key={item}>{item}</span>)}</div></div></section>
    <div className="lower"><section className="advice"><header className="panel-head"><div><div className="section-no">03 / RESUME EDIT</div><h3>简历优化建议</h3></div><span className="priority">{result.suggestions.length} 项优先修改</span></header>{result.suggestions.map((item, index) => <div className="advice-item" key={`${item.title}-${index}`}><b>{String(index + 1).padStart(2, "0")}　{item.title}</b><div className="original">{item.original}</div><div className="improved"><span>建议：</span>{item.suggested}</div></div>)}</section><div className="stack"><section className="letter"><header className="panel-head"><div><div className="section-no">04 / COVER LETTER</div><h3>为你写一封信</h3></div><button className="copy" type="button" onClick={() => void navigator.clipboard.writeText(letterForCopy)}>可复制</button></header><div className="letter-body">{result.coverLetter.split("\n").map((line, index) => line ? <p key={index}>{line}</p> : <br key={index} />)}<p className="letter-date">{formatChinaDate(generatedAt)}</p></div></section></div></div>
    <section className="questions"><header className="panel-head"><div><div className="section-no">05 / INTERVIEW PREP</div><h3>带着答案，走进面试。</h3></div><span className="priority">10 个高概率问题</span></header><p className="intro">围绕岗位最看重的能力，提前组织属于你的真实故事。</p><div className="question-grid">{result.interviewQuestions.map((item, index) => <article className="question" key={`${item.question}-${index}`}><span className="q-num">{String(index + 1).padStart(2, "0")}</span><h4>{item.question}</h4><p><b>参考：</b>{item.answer}</p></article>)}</div></section>
  </section>;
}
