import { printToFileAsync } from 'expo-print';
import { isAvailableAsync, shareAsync } from 'expo-sharing';
export async function exportScoreReport(html:string) {
  if (!await isAvailableAsync()) throw new Error('此裝置目前無法分享 PDF，請改用 PC 匯出。');
  const {uri}=await printToFileAsync({html,width:842,height:595});
  await shareAsync(uri,{mimeType:'application/pdf',UTI:'.pdf',dialogTitle:'儲存或分享員工計分報表'});
}
