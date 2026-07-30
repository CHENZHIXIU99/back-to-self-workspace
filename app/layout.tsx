import type { Metadata, Viewport } from "next";
import "./globals.css";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const metadata:Metadata={
  title:"橙子成长工作台",
  description:"记录工作、生活、健康与成长。",
  applicationName:"橙子成长工作台",
  appleWebApp:{capable:true,statusBarStyle:"default",title:"橙子工作台"},
  manifest:`${basePath}/manifest.webmanifest`,
  icons:{icon:`${basePath}/icon.png`,apple:`${basePath}/icon.png`},
  openGraph:{title:"橙子成长工作台",description:"按自己的节奏，记录每一点成长。",images:[{url:"https://chenzhixiu99.github.io/back-to-self-workspace/og-v2.png",width:1672,height:941,alt:"橙子成长工作台"}]},
  twitter:{card:"summary_large_image",title:"橙子成长工作台",description:"按自己的节奏，记录每一点成长。",images:["https://chenzhixiu99.github.io/back-to-self-workspace/og-v2.png"]}
};
export const viewport:Viewport={width:"device-width",initialScale:1,viewportFit:"cover",themeColor:[{media:"(prefers-color-scheme: light)",color:"#f4f1ea"},{media:"(prefers-color-scheme: dark)",color:"#1c201e"}]};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="zh-CN"><body>{children}</body></html>}
