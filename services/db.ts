
import { PerformanceRecord } from '../types';

const DB_NAME = 'PipePerformDB';
const STORE_NAME = 'records';
const DB_VERSION = 1;

// 初始化数据库
export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error("Database error: ", event);
      reject("Database failed to open");
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
};

// 获取所有记录
export const getAllRecords = async (): Promise<PerformanceRecord[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      // 确保按日期排序 (倒序)
      const data = request.result as PerformanceRecord[];
      data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      resolve(data);
    };
    request.onerror = () => reject(request.error);
  });
};

// 保存或更新记录
export const saveRecord = async (record: PerformanceRecord): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(record);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

// 删除记录
export const deleteRecord = async (id: string): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

// 批量导入 (用于恢复备份)
export const bulkImportRecords = async (records: PerformanceRecord[]): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    let processed = 0;
    if (records.length === 0) resolve();

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);

    records.forEach(record => {
      store.put(record);
    });
  });
};
