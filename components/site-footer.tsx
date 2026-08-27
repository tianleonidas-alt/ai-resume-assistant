import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="footer-row">
        <span className="site-footer-brand">履历 · CAREER INTELLIGENCE</span>
        <span className="footer-links">
          <Link href="/pricing">定价</Link>
          <Link href="/terms">服务条款</Link>
          <Link href="/privacy">隐私政策</Link>
          <a href="mailto:tianleonidas@gmail.com">联系客服</a>
        </span>
      </div>
      <div className="footer-row footer-sub">
        <span>客服邮箱：<a href="mailto:tianleonidas@gmail.com">tianleonidas@gmail.com</a></span>
        <span>© 2026 履历 · Career Brief</span>
      </div>
    </footer>
  );
}
