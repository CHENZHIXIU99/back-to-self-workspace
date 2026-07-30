import type { Metadata, Viewport } from "next";
import "./globals.css";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const metadata:Metadata={
  title:"BackToSelf Workspace",
  description:"把注意力重新放回身体、工作、生活和成长。",
  applicationName:"BackToSelf Workspace",
  appleWebApp:{capable:true,statusBarStyle:"default",title:"BackToSelf"},
  manifest:`${basePath}/manifest.webmanifest`,
  icons:{icon:`${basePath}/icon.svg`,apple:`${basePath}/icon.svg`},
  openGraph:{title:"BackToSelf Workspace",description:"今天，只完成眼前这一小步。"},
  twitter:{card:"summary",title:"BackToSelf Workspace",description:"今天，只完成眼前这一小步。"}
};
export const viewport:Viewport={width:"device-width",initialScale:1,viewportFit:"cover",themeColor:[{media:"(prefers-color-scheme: light)",color:"#f4f1ea"},{media:"(prefers-color-scheme: dark)",color:"#1c201e"}]};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="zh-CN"><body>{children}</body></html>}
