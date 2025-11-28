
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { IndustryType, ProductType, ExtractionResult, AISettings, EquipmentItem } from "../types";

// Limit increased to 30MB as requested
const MAX_FILE_SIZE_MB = 30;

// Helper to convert file to base64
export const fileToGenerativePart = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const base64Data = base64String.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = () => reject(new Error("文件读取失败，请重试。"));
    reader.readAsDataURL(file);
  });
};

const PROMPT_TEXT = `
你是一家生产“内衬管道”(Lined Pipes)和“容器”(Vessels)企业的资深销售工程师助手。
你的任务是分析合同(Contracts)或技术图纸(Technical Drawings)，提取用于企业业绩表(Track Record)的关键数据。

请严格遵守以下规则：
1. **识别项目和客户**：提取甲方（客户）和工程名称。
2. **识别总金额**：提取合同总金额（数字）。
3. **分类行业**：判断行业（如：化工, 石油, 医药等）。
4. **分类产品**：
   - "Lined Pipe (内衬管道)"：管道, 管件, 弯头, 三通。
   - "Vessel (容器)"：储罐, 反应釜, 塔器, 换热器, 分离器。
5. **提取设备清单 (Items List)**：
   - 这是一个非常重要的步骤。请仔细阅读文档中的“供货清单”、“设备一览表”或图纸标题栏。
   - 提取每一项设备的：**名称**、**规格型号** (如 DN2000*5000, V=50m3)、**材质** (如 S30408, PTFE)、**数量**。
   - 如果是容器，请判断其**容器类别** (一类/二类/三类/类外/ASME)。
   - 即使只有一项设备，也要作为清单的第一项返回。
6. **总结项目内容**：生成一段中文描述，概括供货范围。
7. **必须返回纯 JSON 格式**，不要包含 markdown 格式化符号（如 \`\`\`json）。
`;

const responseSchemaObj = {
  type: Type.OBJECT,
  properties: {
    projectName: { type: Type.STRING, description: "项目名称" },
    clientName: { type: Type.STRING, description: "客户名称" },
    amount: { type: Type.NUMBER, description: "合同金额 (未知则为0)" },
    currency: { type: Type.STRING, description: "货币单位 (CNY, USD)" },
    industry: { 
      type: Type.STRING, 
      enum: Object.values(IndustryType),
      description: "行业分类" 
    },
    productType: { 
      type: Type.STRING, 
      enum: Object.values(ProductType),
      description: "产品大类" 
    },
    date: { type: Type.STRING, description: "日期格式 YYYY-MM-DD" },
    description: { type: Type.STRING, description: "供货范围简述 (中文)" },
    items: {
      type: Type.ARRAY,
      description: "设备详细清单",
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "设备名称 (如: 反应釜, 直管)" },
          specifications: { type: Type.STRING, description: "规格型号/技术参数" },
          material: { type: Type.STRING, description: "材质" },
          quantity: { type: Type.STRING, description: "数量" },
          vesselCategory: { type: Type.STRING, description: "容器监管类别 (仅容器填：一类/二类/三类/类外)" },
        }
      }
    }
  },
  required: ["projectName", "clientName", "industry", "productType", "description", "items"],
};

// --- Validation Logic ---
const validateData = (data: ExtractionResult): string[] => {
  const warnings: string[] = [];

  // 1. 金额校验
  if (!data.amount || data.amount <= 0) {
    warnings.push("⚠️ 合同金额未识别或为 0，请手动确认。");
  }

  // 2. 日期校验
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!data.date || !dateRegex.test(data.date)) {
    warnings.push("⚠️ 日期格式无效或未提取到，建议格式 YYYY-MM-DD。");
  } else {
    const year = parseInt(data.date.split('-')[0]);
    const currentYear = new Date().getFullYear();
    if (year < 2000 || year > currentYear + 5) {
       warnings.push(`⚠️ 识别到的年份 (${year}) 似乎不合理，请检查。`);
    }
  }

  // 3. 必填字段校验
  if (!data.projectName || data.projectName.length < 2) warnings.push("⚠️ 项目名称可能不完整。");
  if (!data.clientName || data.clientName.length < 2) warnings.push("⚠️ 客户名称可能不完整。");

  // 4. 设备清单校验
  if (!data.items || data.items.length === 0) {
    warnings.push("⚠️ 未提取到具体的设备清单 (Items)，请手动添加。");
  } else {
    // 检查清单项完整性
    const incompleteItems = data.items.filter(i => !i.name || !i.quantity);
    if (incompleteItems.length > 0) {
      warnings.push(`⚠️ 有 ${incompleteItems.length} 项设备缺少名称或数量。`);
    }
  }

  return warnings;
};

// --- Generic Helper for OpenAI/Local ---
const callOpenAICompatible = async (
  payload: any,
  settings: AISettings,
  isJson: boolean = true
): Promise<string> => {
  const response = await fetch(`${settings.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${settings.apiKey}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`AI Request Failed: ${response.status} - ${err}`);
  }

  const data = await response.json();
  let content = data.choices[0].message.content;

  if (isJson) {
     // Clean markdown block
     content = content.replace(/```json/g, '').replace(/```/g, '').trim();
  }
  return content;
};

// --- Generic Text Generation Helper ---
const generateText = async (prompt: string, settings: AISettings): Promise<string> => {
  if (settings.provider === 'gemini') {
    const ai = new GoogleGenAI({ apiKey: settings.apiKey });
    const response = await ai.models.generateContent({
      model: settings.modelName,
      contents: prompt,
    });
    return response.text || '';
  } else {
    const payload = {
      model: settings.modelName,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7
    };
    return callOpenAICompatible(payload, settings, false);
  }
};

// --- Main Extraction Function ---
export const extractDataFromDocument = async (file: File, settings: AISettings): Promise<ExtractionResult> => {
  
  if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
    throw new Error(`文件过大 (${(file.size / 1024 / 1024).toFixed(2)}MB)。最大支持 ${MAX_FILE_SIZE_MB}MB。建议先压缩。`);
  }

  const base64Data = await fileToGenerativePart(file);
  let jsonString = '';

  try {
    if (settings.provider === 'gemini') {
      const ai = new GoogleGenAI({ apiKey: settings.apiKey });
      const mimeType = file.type;
      
      const response = await ai.models.generateContent({
        model: settings.modelName,
        contents: {
          parts: [
            { inlineData: { mimeType: mimeType, data: base64Data } },
            { text: PROMPT_TEXT }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: responseSchemaObj as any,
        }
      });
      jsonString = response.text || '{}';

    } else {
      // OpenAI / Local Vision
      const payload = {
        model: settings.modelName,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: PROMPT_TEXT + " 返回 JSON。" },
              { type: "image_url", image_url: { url: `data:${file.type};base64,${base64Data}` } }
            ]
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 2000
      };
      jsonString = await callOpenAICompatible(payload, settings, true);
    }

    const data: ExtractionResult = JSON.parse(jsonString);
    data.validationWarnings = validateData(data);
    return data;

  } catch (e: any) {
    console.error("AI Extraction Error:", e);
    
    // Friendly error for Rpc/Xhr failure (common with large files)
    if (e.message?.includes("Rpc failed") || e.message?.includes("xhr error") || e.message?.includes("error code: 6")) {
       throw new Error(`文件上传中断。原因：文件过大 (${(file.size / 1024 / 1024).toFixed(1)}MB) 导致网络传输超时。请尝试压缩 PDF 或使用图片格式。`);
    }

    if (e.message?.includes("JSON")) {
       throw new Error("AI 返回的数据格式无法解析。可能是文件内容过于模糊或不相关。");
    }

    throw e;
  }
};

// --- Feature: Generate Description from Items ---
export const generateDescriptionFromItems = async (items: EquipmentItem[], settings: AISettings): Promise<string> => {
  if (!items || items.length === 0) return "";

  const itemsJson = JSON.stringify(items.map(i => `${i.name} ${i.specifications} x${i.quantity}`));
  const prompt = `
    作为销售助理，请根据以下设备清单，写一段简练的中文“供货内容简述”，用于业绩表。
    要求：
    1. 包含主要设备名称、关键规格(如体积/材质)和总数量。
    2. 语言通顺，商务风格。
    3. 字数控制在 50 字以内。
    4. 不要包含“设备清单如下”等废话，直接输出内容。
    
    设备清单: ${itemsJson}
  `;

  try {
    const text = await generateText(prompt, settings);
    return text.trim().replace(/^['"]|['"]$/g, '');
  } catch (e) {
    console.error("Description Gen Error", e);
    return "生成失败，请重试";
  }
};

// --- Feature: Suggest Project Names ---
export const suggestProjectNames = async (clientName: string, items: EquipmentItem[], settings: AISettings): Promise<string[]> => {
  const itemsSummary = items.slice(0, 5).map(i => i.name).join(', ');
  const prompt = `
    已知客户为：“${clientName}”，采购设备包含：“${itemsSummary}”。
    请结合行业知识，推测 3 个可能的“工程项目名称”。
    
    格式要求：
    1. 返回 3 个名称，每行一个。
    2. 名称应像真实的项目名，如“年产5万吨PVDF项目”或“二期技改工程”。
    3. 只返回名称，不要标号。
  `;

  try {
    const text = await generateText(prompt, settings);
    return text.split('\n').map(s => s.trim().replace(/^- |\d+\. /, '')).filter(s => s.length > 0);
  } catch (e) {
     console.error("Project Name Gen Error", e);
     return [];
  }
};
