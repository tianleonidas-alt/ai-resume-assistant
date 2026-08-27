import Link from "next/link";
import { SiteNav } from "@/components/site-nav";

export default function TermsPage() {
  return (
    <>
      <SiteNav />
      <main className="legal-shell">
        <div className="section-no">LEGAL / TERMS</div>
        <h1>服务条款</h1>
        <p className="legal-updated">更新日期：2026 年 8 月 24 日</p>
        <section>
          <h2>1. 服务范围</h2>
          <p>本站（“履历 · Career Brief”，https://tianzhaoqun.top，以下简称“本站”）基于人工智能模型，为用户提供简历文本解析、岗位匹配度分析、求职材料优化建议与在线简历页生成等服务。服务以“按现状”提供，本站会持续改进功能与模型，但不对 AI 输出内容的绝对准确性、完整性与适用性作出保证。</p>
        </section>
        <section>
          <h2>2. 账号与点数规则</h2>
          <p>使用部分功能需要注册账号。每个账号注册后赠送 2 次免费额度；“简历分析 + 生成在线简历页”的完整流程每次消耗 1 点（免费额度优先），分析失败不扣费、可重试。点数余额以本站记录为准，仅可用于本站服务，不可转让、不可兑换现金。因您自身操作失误导致的点数消耗，本站原则上不予以退还。</p>
        </section>
        <section>
          <h2>3. 支付与退款</h2>
          <p>点数充值由支付平台 Waffo（waffo.com / waffo.ai）提供托管收银台与支付处理。支付相关疑问、订单与退款事宜，请优先通过 Waffo 官方客服渠道（merchant.support@waffo.com）联系处理；本站会配合 Waffo 完成订单核对与点数入账。退款是否成立以 Waffo 的处理结果为准。</p>
        </section>
        <section>
          <h2>4. 用户行为</h2>
          <p>用户不得利用本站从事以下行为：批量注册或滥用免费额度；上传违法、侵权或含有他人隐私的简历与材料；对本服务进行爬取、逆向或干扰；利用生成内容从事欺诈、骚扰或其他违法活动。违反上述规定时，本站有权暂停或终止相应账号的服务。</p>
        </section>
        <section>
          <h2>5. 免责声明</h2>
          <p>AI 生成的分析、建议与在线简历页内容仅供参考，不构成任何录用、签约或职业决策承诺。用户应对投递材料的真实性与最终内容负责，并自行核实关键信息。因使用生成内容产生的任何直接或间接损失，本站不承担超出法律规定的责任。</p>
        </section>
        <section>
          <h2>6. 服务变更与终止</h2>
          <p>本站可能根据业务需要调整点数规则、价格或服务内容，并会通过站内公告等方式提前告知。本站有权在符合法律法规的前提下暂停或终止部分或全部服务。</p>
        </section>
        <section>
          <h2>7. 联系我们</h2>
          <p>如对本条款有任何疑问，请通过客服邮箱 <a href="mailto:tianleonidas@gmail.com">tianleonidas@gmail.com</a> 与我们联系；支付相关订单问题也可通过支付平台 Waffo 客服渠道处理。</p>
        </section>
        <p className="legal-back"><Link href="/">← 返回首页</Link></p>
      </main>
    </>
  );
}
