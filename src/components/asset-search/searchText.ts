const HAN_GROUPS = [
  '链鏈', '结結', '节節', '项項', '发髮', '仆僕', '贴貼', '饰飾', '镯鐲', '装裝',
  '裤褲', '袜襪', '带帶', '绳繩', '锁鎖', '颈頸', '头頭', '体體', '环環', '纹紋',
  '边邊', '层層', '单單', '双雙', '长長', '短短', '开開', '关關', '银銀', '宝寶',
  '贝貝', '镜鏡', '钉釘', '钩鉤', '针針', '铁鐵', '铜銅', '铠鎧', '镣鐐', '护護',
  '绑綁', '缚縛', '紧緊', '松鬆', '启啟', '闭閉', '隐隱', '显顯', '颜顏', '图圖',
  '无無', '胶膠', '细細', '炽熾', '恶惡', '灵靈', '赛賽', '师師', '动動', '诺諾',
  '时時', '换換', '绒絨', '坠墜', '纱紗', '绘繪', '连連', '渐漸', '脸臉', '绷繃',
  '剧劇', '机機', '鳍鰭', '钿鈿', '内內', '圆圓', '诞誕', '圣聖', '报報', '纸紙',
  '复復', '苏蘇', '兰蘭', '样樣', '鲜鮮', '艳豔', '价價', '谊誼', '后後', '义義',
  '严嚴', '玛瑪', '凉涼', '绸綢', '书書', '围圍', '离離', '电電', '击擊', '领領',
  '侧側', '员員', '学學', '园園', '朋龐', '乔喬', '枪槍', '宽寬', '档檔', '质質',
  '块塊', '飞飛', '阳陽', '线線', '皱皺', '热熱', '闪閃', '创創', '间間', '运運',
  '视視', '壳殼', '爱愛', '镂鏤', '叉衩', '优優', '军軍', '对對', '称稱', '妇婦',
  '铅鉛', '笔筆', '务務', '队隊', '隶隸', '夹夾', '鸡雞', '织織', '锦錦', '云雲',
  '诱誘', '戰战', '鬥斗', '韵韻',

  '纤纖', '维維', '缎緞', '丝絲', '红紅', '绿綠', '蓝藍', '黑黒', '黄黃','绣繡',
  '缝縫', '编編', '钮鈕', '刺莿', '纺紡', '烫燙', '补補', '订訂', '软軟','绢絹',
  '襬擺'
];

const HAN_MAP = new Map<string, string>();
for (const group of HAN_GROUPS) for (const char of group) HAN_MAP.set(char, group[0]);

function normalize(value: string): string {
  return [...value.normalize('NFKC').toLocaleLowerCase()]
    .map(char => HAN_MAP.get(char) ?? char)
    .join('')
    .replace(/[\s_:：·'"()（）-]|\[|\]/g, '');
}

export function hasSearchText(value: string): boolean {
  return normalize(value).length > 0;
}

export function fuzzyMatch(haystack: string, needle: string): boolean {
  const text = normalize(haystack), query = normalize(needle);
  if (!query || text.includes(query)) return true;
  let cursor = 0;
  for (const char of text) if (char === query[cursor]) cursor++;
  return cursor === query.length;
}
