import React, { useState } from 'react';
import { ChatHistoryProps } from '../types/types';

function ChatHistory({ messages, isLoading = false }: ChatHistoryProps) {
  const [selectedDate, setSelectedDate] = useState<string>('');
  
  const handleScroll = (element: HTMLElement) => {
    const messageDate = element.getAttribute('data-date');
    if (messageDate) {
      setSelectedDate(messageDate);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* 日期 Bar */}
      <div className="sticky top-0 bg-white dark:bg-gray-800 z-10 p-2 border-b">
        <time className="text-sm text-gray-600 dark:text-gray-300">
          {selectedDate}
        </time>
      </div>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto" 
        onScroll={(e) => {
          const elements = document.elementsFromPoint(
            e.currentTarget.offsetLeft,
            e.currentTarget.offsetTop + 100
          );
          const messageElement = elements.find(el => el.hasAttribute('data-date'));
          if (messageElement instanceof HTMLElement) {
            handleScroll(messageElement);
          }
        }}
      >
        {messages.map((message, index) => (
          <div
            key={index}
            data-date={message.createTime}
            className="relative p-4 mb-4"
          >
            {/* 時間軸 */}
            <div className="absolute left-0 top-0 h-full w-px bg-red-200 dark:bg-red-800">
              <div className="absolute -left-1.5 top-6 w-3 h-3 rounded-full bg-red-500 ring-4 ring-red-200 dark:ring-red-800" />
            </div>
            
            {/* 消息卡片 */}
            <div className="ml-8 p-4 rounded-lg bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 transition-all duration-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {message.role === 'user' ? '你' : 'AI'}
                </span>
                <time className="text-xs text-gray-500 dark:text-gray-400">
                  {formatDate(message.createTime)}
                </time>
              </div>
              <div className="prose dark:prose-invert max-w-none">
                {message.content}
              </div>
            </div>
          </div>
        ))}

        {/* 載入動畫 */}
        {isLoading && (
          <div className="relative p-4 mb-4">
            <div className="absolute left-0 top-0 h-full w-px bg-gray-200 dark:bg-gray-700">
              <div className="absolute -left-1.5 top-6 w-3 h-3 rounded-full bg-gray-400 animate-pulse" />
            </div>
            <div className="ml-8 p-4 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
              <div className="animate-pulse space-y-2">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function formatDate(dateString?: string) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('zh-TW', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

export default ChatHistory; 