import {isZh} from '@/core/lang';

export function AboutAee() {
  return <div className="p-4 text-left text-xs leading-6 text-zinc-500">
    {isZh() ? <>
      <b className="text-zinc-300">關於 AEE</b><br/>• 不需要 LSCG 也能使用透明度與位移效果<br/>•
      旋轉、縮放、傾斜、鏡射為測試功能，不保證長期穩定<br/>• 插件具有高度自定義功能，可能存在少量錯誤<br/>• 如遇問題歡迎回報
    </> : <>
      <b className="text-zinc-300">About AEE</b><br/>• Opacity and offset work without LSCG<br/>• Rotate, scale, skew,
      and mirror are experimental<br/>• Highly customizable, minor bugs may occur<br/>• Feedback welcome if issues arise
    </>}
  </div>;
}
