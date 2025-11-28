
export enum ProductType {
  LINED_PIPE = 'Lined Pipe (内衬管道)',
  VESSEL = 'Vessel (容器)',
  FITTINGS = 'Fittings/Valves (管件/阀门)',
  OTHER = 'Other (其他)',
}

export enum IndustryType {
  CHEMICAL = 'Chemical (化工)',
  PETROLEUM = 'Petroleum (石油)',
  PHARMA = 'Pharmaceutical (医药)',
  POWER = 'Power/Energy (电力/能源)',
  WATER_TREATMENT = 'Water Treatment (水处理)',
  METALLURGY = 'Metallurgy (冶金)',
  OTHER = 'Other (其他)',
}

export interface EquipmentItem {
  name: string;          // 设备名称 (e.g. 反应釜, 直管)
  specifications: string;// 规格型号
  material: string;      // 材质
  quantity: string;      // 数量
  vesselCategory?: string; // 容器类别 (仅容器填写)
}

export interface PerformanceRecord {
  id: string;
  projectName: string;
  clientName: string;
  amount: number;
  currency: string;
  industry: IndustryType;
  productType: ProductType;
  date: string;
  description: string; // Summary description
  tags: string[];
  
  // 支持多设备清单
  items: EquipmentItem[];
}

export interface ExtractionResult {
  projectName?: string;
  clientName?: string;
  amount?: number;
  currency?: string;
  industry?: IndustryType;
  productType?: ProductType;
  date?: string;
  description?: string;
  
  // 提取出的设备清单
  items?: EquipmentItem[];
  
  // 校验警告信息
  validationWarnings?: string[];
}

// 新增：AI 配置接口
export type AIProvider = 'gemini' | 'openai' | 'local';

export interface AISettings {
  provider: AIProvider;
  apiKey: string;
  baseUrl: string; // 用于 Local/OpenAI
  modelName: string;
}

export const DEFAULT_AI_SETTINGS: AISettings = {
  provider: 'gemini',
  apiKey: '',
  baseUrl: 'https://api.openai.com/v1', // 或者 http://localhost:11434/v1
  modelName: 'gemini-2.5-flash',
};
