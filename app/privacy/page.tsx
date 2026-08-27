import Link from "next/link";
import { SiteNav } from "@/components/site-nav";

export default function PrivacyPage() {
  return (
    <>
      <SiteNav />
      <main className="legal-shell">
        <div className="section-no">LEGAL / PRIVACY</div>
        <h1>隐私政策</h1>
        <p className="legal-updated">更新日期：2026 年 8 月 24 日</p>
        <section>
          <h2>1. 我们收集的信息</h2>
          <p>本站（“履历 · Career Brief”，https://tianzhaoqun.top）为提供服务，会收集：账号信息（邮箱地址）、您上传的简历文本与 PDF、填写的目标岗位描述、分析结果与在线简历页内容、使用记录（如分析/生成时间）、点数与订单记录，以及必要的设备与访问日志（用于安全防护）。</p>
        </section>
        <section>
          <h2>2. 信息的使用</h2>
          <p>我们仅在必要范围内使用上述信息：生成分析与在线简历页、管理点数与订单、进行模型用量与成本统计、保障账号安全与防止滥用，以及改进服务质量。我们不会将您的简历内容用于训练或出售给第三方。</p>
        </section>
        <section>
          <h2>3. 第三方服务</h2>
          <p>本站依赖以下第三方服务：Supabase（数据库与账号认证）、DeepSeek 与阿里云百炼（大模型推理，处理时会向其发送必要的简历/岗位文本）、Waffo（支付处理，仅提供订单所需信息）。各第三方按其自身隐私政策处理相应数据。</p>
        </section>
        <section>
          <h2>4. 存储与安全</h2>
          <p>您的数据存储于 Supabase 提供的数据库中，并采取访问控制（RLS）等安全措施。简历与分析结果默认仅您本人可见；您主动发布的在线简历页（公开页）会对访客可见。我们建议您不要在简历中填写不必要的敏感个人信息。</p>
        </section>
        <section>
          <h2>5. 数据保留与删除</h2>
          <p>账号存续期间，我们保留提供服务所必需的数据。您可联系管理员删除账号及相关数据；公开简历页被删除或取消发布后，对应公开链接将失效。法律另有规定的除外。</p>
        </section>
        <section>
          <h2>6. 联系我们</h2>
          <p>如对隐私政策有任何疑问或希望行使数据权利，请通过客服邮箱 <a href="mailto:tianleonidas@gmail.com">tianleonidas@gmail.com</a> 与我们联系。</p>
        </section>
        <p className="legal-back"><Link href="/">← 返回首页</Link></p>
      </main>
    </>
  );
}
