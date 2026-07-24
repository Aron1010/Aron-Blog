export type FooterConfig = {
	enable: boolean; // 是否启用Footer HTML注入功能
	customHtml?: string; // 自定义HTML内容，用于添加备案号等信息
	visitCounter?: {
		enable: boolean; // 是否显示今日、本月和累计访问量
		namespace: string; // CounterAPI 公共计数器命名空间
		apiUrl?: string; // CounterAPI API 地址
		timezone?: string; // 日期统计时区
	};
};
