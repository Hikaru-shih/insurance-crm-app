export async function exportScoreReport(html:string) {
  const target=window.open('','_blank');
  if(!target) throw new Error('請允許開啟報表視窗後再試一次。');
  target.opener=null;
  target.document.open();target.document.write(html);target.document.close();
}
