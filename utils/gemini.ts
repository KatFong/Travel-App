export async function getGeminaResponse(prompt: string) {
  try {
    const response = await fetch(/* ... */);
    const data: GeminaResponse = await response.json();
    
    // 提取日期資訊
    const createTime = data.candidates[0]?.createTime;
    const updateTime = data.candidates[0]?.updateTime;
    
    return {
      text: data.candidates[0]?.content.parts[0]?.text || '',
      createTime,
      updateTime
    };
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    throw error;
  }
} 