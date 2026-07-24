import type { FooterConfig } from "../types/footerConfig";

export const footerConfig: FooterConfig = {
	// 是否启用Footer HTML注入功能
	enable: false,

	// 访问量统计（数据从启用后开始累计）
	visitCounter: {
		enable: true,
		// CounterAPI v1 是公共计数器，请勿在此处放置密码或 API 密钥
		namespace: "aronblake-cloud-a7f3c9",
		apiUrl: "https://api.counterapi.dev/v1",
		timezone: "Asia/Shanghai",
	},
};

// 直接编辑 config/FooterConfig.html 文件来添加备案号等自定义内容
