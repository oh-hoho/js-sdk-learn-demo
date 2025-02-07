import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import { bitable, IField } from '@lark-base-open/js-sdk';
import { Select, Tree } from 'antd';
import { create } from 'jsondiffpatch';
import { diff_match_patch } from 'diff-match-patch';
import type { DataNode } from 'antd/es/tree';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <LoadApp/>
  </React.StrictMode>
)

function LoadApp() {
  const [columns, setColumns] = useState<IField[]>([]);
  const [fieldOptions, setFieldOptions] = useState<{ label: string; value: string }[]>([]);
  const [selectedValue, setSelectedValue] = useState<string>('');
  const [selection, setSelection] = useState<{recordId: string} | null>(null);
  const [selectedFieldId, setSelectedFieldId] = useState<string>('');
  const [selectedFieldName, setSelectedFieldName] = useState<string>('');
  const [debugInfo, setDebugInfo] = useState<string[]>([]);
  const [selectedValue2, setSelectedValue2] = useState<string>('');
  const [selectedFieldId2, setSelectedFieldId2] = useState<string>('');
  const [selectedFieldName2, setSelectedFieldName2] = useState<string>('');
  const [differences, setDifferences] = useState<string[]>([]);
  const [diffPaths, setDiffPaths] = useState<Set<string>>(new Set());

  const addDebugLog = (message: string) => {
    setDebugInfo(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  // 处理字段选择
  const handleFieldSelect = async (fieldId: string) => {
    setSelectedFieldId(fieldId);
    addDebugLog(`字段选择变化: selectedFieldId = ${fieldId}`);
    const field = columns.find(col => col.id === fieldId);
    if (field) {
      const fieldName = await field.getName();
      setSelectedFieldName(fieldName);
      addDebugLog(`字段名称: ${fieldName}`);
    }
  };

  // 添加下拉框点击时更新字段列表的处理函数
  const handleDropdownClick = async () => {
    try {
      const table = await bitable.base.getActiveTable();
      const tableColumns = await table.getFieldList();
      setColumns(tableColumns);
      const options = await Promise.all(
        tableColumns.map(async col => ({
          label: await col.getName(),
          value: col.id
        }))
      );
      setFieldOptions(options);
    } catch (error) {
      console.error('获取字段列表失败：', error);
      addDebugLog(`获取字段列表失败: ${error}`);
    }
  };

  // 处理第二个字段选择
  const handleFieldSelect2 = async (fieldId: string) => {
    setSelectedFieldId2(fieldId);
    addDebugLog(`第二个字段选择变化: selectedFieldId2 = ${fieldId}`);
    const field = columns.find(col => col.id === fieldId);
    if (field) {
      const fieldName = await field.getName();
      addDebugLog(`第二个字段名称设置为: ${fieldName}`);
      setSelectedFieldName2(fieldName);
      addDebugLog(`设置后的 selectedFieldName2: ${fieldName}`);
    } else {
      addDebugLog(`未找到字段ID为 ${fieldId} 的字段`);
    }
  };

  // 监听选择变化
  useEffect(() => {
    const watchSelection = async () => {
      try {
        const table = await bitable.base.getActiveTable();

        const offSelectionWatch = await bitable.base.onSelectionChange(async (selection) => {
          const newSelection = selection.data?.recordId ? { recordId: selection.data.recordId } : null;
          addDebugLog(`选择变化: recordId = ${selection.data?.recordId || '无'}`);
          setSelection(newSelection);
          
          // 处理两个字段的值
          if (newSelection?.recordId) {
            try {
              const record = await table.getRecordById(newSelection.recordId);
              
              // 声明变量存储转换后的值
              let transformedValue1 = null;
              let transformedValue2 = null;
              
              // 处理第一个字段
              if (selectedFieldId) {
                const cellValue = record.fields[selectedFieldId];
                // addDebugLog(`获取到的第一个单元格原始值: ${JSON.stringify(cellValue)}`);
                
                let jsonData;
                try {
                  const parsedValue = JSON.parse(JSON.stringify(cellValue));
                  // addDebugLog(`第一个字段 parsedValue: ${JSON.stringify(parsedValue)}`);
                  const textContent = parsedValue?.[0]?.text;
                  // addDebugLog(`第一个字段 textContent: ${textContent}`);
                  jsonData = textContent ? JSON.parse(textContent) : null;
                  // addDebugLog(`第一个字段 jsonData: ${JSON.stringify(jsonData)}`);
                } catch (e) {
                  addDebugLog(`解析第一个JSON失败: ${e}`);
                  jsonData = null;
                }
                
                transformedValue1 = jsonData ? transformData(jsonData) : null;
                // addDebugLog(`第一个转换后的数据: ${JSON.stringify(transformedValue1)}`);
                setSelectedValue(transformedValue1 ? JSON.stringify(transformedValue1) : '');
              }

              // 处理第二个字段
              if (selectedFieldId2) {
                const cellValue2 = record.fields[selectedFieldId2];
                // addDebugLog(`获取到的第二个单元格原始值: ${JSON.stringify(cellValue2)}`);
                
                let jsonData2;
                try {
                  const parsedValue2 = JSON.parse(JSON.stringify(cellValue2));
                  // addDebugLog(`第二个字段 parsedValue2: ${JSON.stringify(parsedValue2)}`);
                  const textContent2 = parsedValue2?.[0]?.text;
                  // addDebugLog(`第二个字段 textContent2: ${textContent2}`);
                  jsonData2 = textContent2 ? JSON.parse(textContent2) : null;
                  // addDebugLog(`第二个字段 jsonData2: ${JSON.stringify(jsonData2)}`);
                } catch (e) {
                  addDebugLog(`解析第二个JSON失败: ${e}`);
                  jsonData2 = null;
                }
                
                transformedValue2 = jsonData2 ? transformData(jsonData2) : null;
                // addDebugLog(`第二个转换后的数据: ${JSON.stringify(transformedValue2)}`);
                setSelectedValue2(transformedValue2 ? JSON.stringify(transformedValue2) : '');
              }

              // 直接使用转换后的值进行比较
              if (selectedFieldId && selectedFieldId2) {
                try {
                  // 重新获取字段名称
                  const field1 = columns.find(col => col.id === selectedFieldId);
                  const field2 = columns.find(col => col.id === selectedFieldId2);
                  const name1 = await field1?.getName() || selectedFieldName;
                  const name2 = await field2?.getName() || selectedFieldName2;
                  
                  addDebugLog(`比较时的字段名称1: ${name1}, 字段名称2: ${name2}`);
                  
                  const diffs = compareJSON(transformedValue1, transformedValue2, [], { 
                    name1: name1,
                    name2: name2
                  });
                  setDifferences(diffs);
                  updateDiffPaths(diffs);
                  
                  if (diffs.length > 0) {
                    addDebugLog('发现以下差异:');
                    diffs.forEach(diff => addDebugLog(diff));
                  } else {
                    addDebugLog('两个 JSON 完全相同');
                  }
                } catch (error) {
                  addDebugLog(`比较过程出错: ${error}`);
                }
              }
            } catch (error) {
              console.error('获取单元格值时出错：', error);
              addDebugLog(`错误: ${error}`);
            }
          }
        });

        return () => {
          offSelectionWatch();
        };

      } catch (error) {
        console.error('加载表数据出错：', error);
        addDebugLog(`错误: ${error}`);
      }
    };

    watchSelection();
  }, [selectedFieldId, selectedFieldId2]); // 添加 selectedFieldId2 到依赖数组

  // 创建 jsondiffpatch 实例
  const diffpatcher = create({
    arrays: {
      detectMove: true
    },
    textDiff: {
      minLength: 1,
      diffMatchPatch: diff_match_patch
    }
  });

  // 修改差异路径更新函数
  const updateDiffPaths = (diffs: string[]) => {
    const paths = new Set<string>();
    diffs.forEach(diff => {
      // 修改正则表达式以匹配 "标签" 而不是 "路径"
      const match = diff.match(/标签 "([^"]+)"/);
      if (match) {
        // 将完整路径及其所有父路径都添加到集合中
        const fullPath = match[1];
        const parts = fullPath.split('.');
        let currentPath = '';
        parts.forEach(part => {
          currentPath = currentPath ? `${currentPath}.${part}` : part;
          paths.add(currentPath);
          addDebugLog(`自动展开路径: ${currentPath}`);
        });
      }
    });
    setDiffPaths(paths);
  };

  // 修改转换 JSON 为树节点的函数
  const convertJsonToTreeData = (json: any, parentKey = ''): DataNode[] => {
    if (typeof json !== 'object' || json === null) {
      return [];
    }

    return Object.entries(json).map(([key, value], index) => {
      // 处理数组索引的情况
      const currentKey = parentKey 
        ? Array.isArray(json) 
          ? `${parentKey}.[${key}]`  // 数组项使用 [index] 格式
          : `${parentKey}.${key}`    // 对象属性使用 .key 格式
        : key;
      
      const isLeaf = typeof value !== 'object' || value === null;
      const displayValue = isLeaf ? JSON.stringify(value) : '';
      
      return {
        title: Array.isArray(json) ? `[${key}]${displayValue}` : `${key}: ${displayValue}`,
        key: currentKey,
        children: isLeaf ? [] : convertJsonToTreeData(value, currentKey),
      };
    });
  };

  return <div>
    <div>
      {/* 添加说明文本，当两个字段都选择后隐藏 */}
      {(!selectedFieldId || !selectedFieldId2) && (
        <div style={{ 
          textAlign: 'center',
          marginBottom: '12px',
          color: '#666'
        }}>
          请选择需要对比的两列数据
        </div>
      )}

      {/* 修改字段选择区域的样式 */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center',
        gap: '16px',
        marginBottom: '16px'
      }}>
        <Select
          style={{ width: 200 }}
          placeholder="请选择第一个字段"
          options={fieldOptions}
          onChange={handleFieldSelect}
          disabled={!selection?.recordId}
          value={selectedFieldId}
          onDropdownVisibleChange={(open) => {
            if (open) {
              handleDropdownClick();
            }
          }}
        />
        <Select
          style={{ width: 200 }}
          placeholder="请选择第二个字段"
          options={fieldOptions}
          onChange={handleFieldSelect2}
          disabled={!selection?.recordId}
          value={selectedFieldId2}
          onDropdownVisibleChange={(open) => {
            if (open) {
              handleDropdownClick();
            }
          }}
        />
      </div>
      {/* 添加差异信息显示区域 */}
      {selectedFieldId && selectedFieldId2 && (
        <div style={{ 
          marginTop: 16,
          padding: 16,
          backgroundColor: '#fff',
          border: '1px solid #d9d9d9',
          borderRadius: 4,
          height: '200px',  // 改为固定高度
          overflow: 'auto',
          display: 'flex',  // 添加 flex 布局
          flexDirection: 'column'  // 垂直方向布局
        }}>
          <h3 style={{ margin: '0 0 12px 0' }}>两个结果的差异：</h3>
          <div style={{ flex: 1, overflow: 'auto' }}>  {/* 内容区域自适应 */}
            {differences.length > 0 ? (
              differences.map((diff, index) => (
                <div 
                  key={index}
                  style={{
                    padding: '8px 0',
                    borderBottom: index < differences.length - 1 ? '1px solid #f0f0f0' : 'none',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all'
                  }}
                >
                  {diff}
                </div>
              ))
            ) : (
              <div style={{ padding: '8px 0' }}>结果一致</div>
            )}
          </div>
        </div>
      )}

      {/* 替换对比展示区域的组件 */}
      {selectedFieldId && selectedFieldId2 && (
        <div style={{ 
          backgroundColor: '#fff',
          padding: '16px',
          border: '1px solid #d9d9d9',
          borderRadius: '4px'
        }}>
          <div style={{ 
            marginBottom: '8px',
            display: 'flex',
            justifyContent: 'center',  // 水平居中
            gap: '32px'  // 增加间距
          }}>
            <span>左侧: {selectedFieldName}</span>
            <span>右侧: {selectedFieldName2}</span>
          </div>
          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ flex: 1 }}>
              <Tree
                treeData={convertJsonToTreeData(JSON.parse(selectedValue || '{}'))}
                expandedKeys={Array.from(diffPaths)}
                defaultExpandAll={false}
                autoExpandParent={true}
                showLine={{ showLeafIcon: false }}
                onExpand={(expandedKeys) => {
                  setDiffPaths(new Set(expandedKeys.map(key => String(key))));
                }}
                titleRender={(node: DataNode) => {
                  // 检查是否是差异路径的叶子节点
                  const isLeafDiff = diffPaths.has(node.key as string) && 
                    !Array.from(diffPaths).some(path => 
                      path.startsWith(`${node.key as string}.`) || 
                      path.startsWith(`${node.key as string}.[`)
                    );
                  
                  return (
                    <span style={{ 
                      padding: '2px 4px',
                      backgroundColor: isLeafDiff ? '#ffebee' : 'transparent',
                      borderRadius: '2px'
                    }}>
                      {node.title as string}
                    </span>
                  );
                }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <Tree
                treeData={convertJsonToTreeData(JSON.parse(selectedValue2 || '{}'))}
                expandedKeys={Array.from(diffPaths)}
                defaultExpandAll={false}
                autoExpandParent={true}
                showLine={{ showLeafIcon: false }}
                onExpand={(expandedKeys) => {
                  setDiffPaths(new Set(expandedKeys.map(key => String(key))));
                }}
                titleRender={(node: DataNode) => {
                  // 检查是否是差异路径的叶子节点
                  const isLeafDiff = diffPaths.has(node.key as string) && 
                    !Array.from(diffPaths).some(path => 
                      path.startsWith(`${node.key as string}.`) || 
                      path.startsWith(`${node.key as string}.[`)
                    );
                  
                  return (
                    <span style={{ 
                      padding: '2px 4px',
                      backgroundColor: isLeafDiff ? '#ffebee' : 'transparent',
                      borderRadius: '2px'
                    }}>
                      {node.title as string}
                    </span>
                  );
                }}
              />
            </div>
          </div>
        </div>
      )}

      
      {/* 调试信息区域 - 已注释掉
      <div style={{ 
        marginTop: 32,
        padding: 16,
        backgroundColor: '#f5f5f5',
        borderRadius: 4,
        maxHeight: '300px',
        overflow: 'auto'
      }}>
        <h3>调试信息:</h3>
        {debugInfo.map((log, index) => (
          <div key={index} style={{ 
            borderBottom: '1px solid #e8e8e8',
            padding: '8px 0',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all'
          }}>
            {log}
          </div>
        ))}
      </div>
      */}
    </div>
  </div>
}

/**
 * 将原始数据转换为目标格式
 * @param data 原始数据对象
 * @returns 转换后的数据对象
 */
function transformData(data: any): any {
  if (typeof data !== 'object' || data === null) {
    return data;
  }

  // 定义字段名称映射关系
  const fieldMapping: { [key: string]: string } = {
    'clarity': '清晰度',
    'sceneSize': '景别',
    'markDataList': '标注结果',
    'tree_version': '任务树版本',
    'children': '继发病变',
    'disease_site': '位置',
    'lesion_type': '原发/继发',
    'lesion_position_label': '病变类型',
    'key_tag_list': '关键标签组',
    'non_key_tag_list': '非关键标签组',
    'first_is_key_information': '是否关键病变'
  };

  // 处理 markDataList 数组转对象
  if (Array.isArray(data.markDataList)) {
    const transformedMarkData: any = {};
    data.markDataList.forEach((item: any) => {
      if (item.title) {
        transformedMarkData[item.title] = transformLesionList(item.lesion_list);
      }
    });
    return {
      清晰度: data.clarity,
      景别: data.sceneSize,
      标注结果: transformedMarkData,
      任务树版本: data.tree_version
    };
  }

  return data;
}

/**
 * 转换病变列表数据
 * @param lesionList 原始病变列表数组
 * @returns 转换后的病变列表数组
 */
function transformLesionList(lesionList: any[]): any[] {
  if (!Array.isArray(lesionList)) return [];

  return lesionList.map(lesion => {
    const result: any = {
      病变类型: lesion.lesion_position_label,
      '原发/继发': lesion.lesion_type
    };

    if (lesion.first_is_key_information) {
      result['是否关键病变'] = true;
    }

    if (lesion.children) {
      result['继发病变'] = transformLesionList(lesion.children);
    }

    if (lesion.key_tag_list) {
      result['关键标签组'] = {};
      Object.entries(lesion.key_tag_list).forEach(([key, value]: [string, any]) => {
        const newKey = key === 'disease_site' ? '位置' : value.label;
        if (value.value) {
          if (Array.isArray(value.value)) {
            result['关键标签组'][newKey] = value.value.map((v: any) => 
              typeof v === 'object' ? v.label : v
            );
          } else {
            result['关键标签组'][newKey] = [value.value];
          }
        } else {
          result['关键标签组'][newKey] = ["null"];
        }
      });
    }

    if (lesion.non_key_tag_list) {
      result['非关键标签组'] = {};
      Object.entries(lesion.non_key_tag_list).forEach(([key, value]: [string, any]) => {
        const newKey = value.label;
        if (value.value) {
          result['非关键标签组'][newKey] = Array.isArray(value.value) ? value.value : [value.value];
        } else {
          result['非关键标签组'][newKey] = ["null"];
        }
      });
    }

    return result;
  });
}

// 修改函数定义
function compareJSON(obj1: any, obj2: any, path: string[] = [], fieldNames: { name1: string, name2: string }): string[] {
  const differences: string[] = [];
  
  // 处理 null 或 undefined 的情况
  if (obj1 === null || obj1 === undefined || obj2 === null || obj2 === undefined) {
    if (obj1 !== obj2) {
      differences.push(`标签 "${path.join('.')}" 的值不同:\n${fieldNames.name1}: ${JSON.stringify(obj1)}\n${fieldNames.name2}: ${JSON.stringify(obj2)}`);
    }
    return differences;
  }

  // 处理非对象类型
  if (typeof obj1 !== 'object' || typeof obj2 !== 'object') {
    if (obj1 !== obj2) {
      differences.push(`标签 "${path.join('.')}" 的值不同:\n${fieldNames.name1}: ${JSON.stringify(obj1)}\n${fieldNames.name2}: ${JSON.stringify(obj2)}`);
    }
    return differences;
  }

  // 处理数组
  if (Array.isArray(obj1) && Array.isArray(obj2)) {
    // 先比较共同长度部分
    const minLength = Math.min(obj1.length, obj2.length);
    for (let i = 0; i < minLength; i++) {
      differences.push(...compareJSON(obj1[i], obj2[i], [...path, `[${i}]`], fieldNames));
    }
    
    // 处理多出来的部分
    if (obj1.length > obj2.length) {
      for (let i = minLength; i < obj1.length; i++) {
        differences.push(`标签 "${path.join('.')}.[${i}]" 被删除:\n${fieldNames.name1}: ${JSON.stringify(obj1[i])}`);
      }
    } else if (obj2.length > obj1.length) {
      for (let i = minLength; i < obj2.length; i++) {
        differences.push(`标签 "${path.join('.')}.[${i}]" 新增:\n${fieldNames.name2}: ${JSON.stringify(obj2[i])}`);
      }
    }
    return differences;
  }

  // 处理对象
  const allKeys = new Set([...Object.keys(obj1 || {}), ...Object.keys(obj2 || {})]);
  for (const key of allKeys) {
    const newPath = [...path, key];
    const value1 = obj1?.[key];
    const value2 = obj2?.[key];
    
    if (!(key in (obj1 || {}))) {
      differences.push(`标签 "${newPath.join('.')}" 新增:\n${fieldNames.name2}: ${JSON.stringify(value2)}`);
      continue;
    }
    
    if (!(key in (obj2 || {}))) {
      differences.push(`标签 "${newPath.join('.')}" 被删除:\n${fieldNames.name1}: ${JSON.stringify(value1)}`);
      continue;
    }

    differences.push(...compareJSON(value1, value2, newPath, fieldNames));
  }

  return differences;
}