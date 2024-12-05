interface GeminaResponse {
  candidates: {
    content: {
      parts: {
        text: string;
      }[];
    };
    finishReason: string;
    index: number;
    safetyRatings: any[];
    citationMetadata?: any;
    createTime?: string;
    updateTime?: string;
  }[];
  promptFeedback: {
    safetyRatings: any[];
  };
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  createTime?: string;
}

interface ChatHistoryProps {
  messages: Message[];
  isLoading?: boolean;
} 