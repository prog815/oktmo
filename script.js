// ==================== ИНТЕРАКТИВНЫЙ СПРАВОЧНИК ОКТМО ====================
// Минимальная рабочая версия
// Основная цель: поиск работает, результаты показываются

document.addEventListener('DOMContentLoaded', function() {
    console.log('🔍 Инициализация справочника ОКТМО');
    
    // Проверяем данные
    if (typeof oktmoData === 'undefined') {
        console.error('❌ Данные ОКТМО не загружены! Проверьте файл data.js');
        document.getElementById('resultsContainer').innerHTML = 
            '<div class="no-results">Ошибка загрузки данных</div>';
        return;
    }
    
    console.log(`✅ Данные загружены: ${oktmoData.length} записей`);
    
    // Элементы DOM
    const searchInput = document.getElementById('searchInput');
    const resultsContainer = document.getElementById('resultsContainer');
    const filterMunicipal = document.getElementById('filterMunicipal');
    const filterSettlements = document.getElementById('filterSettlements');
    const filterSubject = document.getElementById('filterSubject');
    
    // ==================== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ====================
    
    // Парсинг одной записи данных
    function parseDataItem(index) {
        const item = oktmoData[index];
        if (!item) return null;
        
        const code = item[0] || '';
        const name = item[1] || '';
        const recordType = item[2] || 0; // 1=муниципалитет, 2=населенный пункт
        const typeCode = item[3] || 0;
        
        // Анализируем структуру кода
        const codeAnalysis = analyzeOktmoCode(code, recordType);
        
        return {
            code: code,
            name: name,
            recordType: recordType,
            typeCode: typeCode,
            isAdminCenter: item[4] || 0,
            statusCode: item[5] || '',
            effectiveDate: item[6] || 0,
            additionalInfo: item[7] || '',
            
            // Вычисляемые поля
            isMunicipal: recordType === 1,
            codeLength: code.length,
            formattedCode: formatValidCode(getValidOktmoCode(code, recordType)),
            subjectCode: codeAnalysis.subjectCode,
            municipalCode: codeAnalysis.municipalCode,
            settlementCode: codeAnalysis.settlementCode,
            index: index
        };
    }

    // Анализ структуры кода ОКТМО
    function analyzeOktmoCode(code, recordType) {
        // Примеры кодов из данных:
        // '005557000114' - 12 знаков, населенный пункт
        // '001512000'    - 9 знаков, муниципалитет
        // '001512000101' - 12 знаков, населенный пункт
        
        const result = {
            subjectCode: '',      // Первые 2 знака (субъект РФ)
            municipalCode: '',    // 8 знаков (муниципальное образование)
            settlementCode: '',   // 11 знаков (населенный пункт)
            fullCode: code
        };
        
        if (!code) return result;
        
        // Всегда берем первые 2 знака как код субъекта
        if (code.length >= 2) {
            result.subjectCode = code.substring(0, 2);
        }
        
        // Для муниципальных образований (recordType = 1)
        if (recordType === 1) {
            // Муниципальный код - обычно 8 знаков, но у нас могут быть 9
            if (code.length >= 8) {
                result.municipalCode = code.substring(0, 8);
            } else {
                result.municipalCode = code;
            }
        }
        // Для населенных пунктов (recordType = 2)
        else if (recordType === 2) {
            // Населенный пункт - обычно 11 знаков, но у нас 12
            if (code.length >= 11) {
                result.municipalCode = code.substring(0, 8); // родительский муниципалитет
                result.settlementCode = code.substring(0, 11); // полный код населенного пункта
            } else if (code.length >= 8) {
                result.municipalCode = code.substring(0, 8);
            }
        }
        
        return result;
    }

    // Форматирование кода ОКТМО с пробелами
    function formatOktmoCode(code, recordType) {
        if (!code) return '';
        
        // Убираем лишние нули в конце (если они есть)
        const cleanCode = code.replace(/0+$/, '');
        const len = cleanCode.length;
        
        // Для муниципальных образований (recordType = 1)
        if (recordType === 1) {
            // Ожидаем 8 знаков: XX XXX XXX
            if (len === 8 || len === 9) {
                return `${cleanCode.substring(0, 2)} ${cleanCode.substring(2, 5)} ${cleanCode.substring(5, 8)}`;
            }
        }
        // Для населенных пунктов (recordType = 2)
        else if (recordType === 2) {
            // Ожидаем 11 знаков: XX XXX XXX YYY
            // Но у нас 12 знаков: XX XXX XXX YYYY
            if (len === 11) {
                return `${cleanCode.substring(0, 2)} ${cleanCode.substring(2, 5)} ${cleanCode.substring(5, 8)} ${cleanCode.substring(8, 11)}`;
            } else if (len === 12) {
                return `${cleanCode.substring(0, 2)} ${cleanCode.substring(2, 5)} ${cleanCode.substring(5, 8)} ${cleanCode.substring(8, 12)}`;
            }
        }
        
        // Универсальное форматирование для любых длин
        if (len === 8) {
            return `${cleanCode.substring(0, 2)} ${cleanCode.substring(2, 5)} ${cleanCode.substring(5, 8)}`;
        } else if (len === 9) {
            return `${cleanCode.substring(0, 2)} ${cleanCode.substring(2, 5)} ${cleanCode.substring(5, 8)} ${cleanCode.substring(8, 9)}`;
        } else if (len === 11) {
            return `${cleanCode.substring(0, 2)} ${cleanCode.substring(2, 5)} ${cleanCode.substring(5, 8)} ${cleanCode.substring(8, 11)}`;
        } else if (len === 12) {
            return `${cleanCode.substring(0, 2)} ${cleanCode.substring(2, 5)} ${cleanCode.substring(5, 8)} ${cleanCode.substring(8, 12)}`;
        }
        
        // Для любых других длин - просто добавляем пробелы через каждые 3 символа
        return cleanCode.replace(/(.{3})/g, '$1 ').trim();
    }
    
    // Форматирование кода с пробелами
    function formatCode(code) {
        if (!code) return '';
        
        // Убираем лишние нули в конце
        const cleanCode = code.replace(/0+$/, '');
        const len = cleanCode.length;
        
        if (len === 8) {
            // Муниципальное образование: XX XXX XXX
            return `${cleanCode.substring(0, 2)} ${cleanCode.substring(2, 5)} ${cleanCode.substring(5, 8)}`;
        } else if (len === 11) {
            // Населенный пункт: XX XXX XXX YYY
            return `${cleanCode.substring(0, 2)} ${cleanCode.substring(2, 5)} ${cleanCode.substring(5, 8)} ${cleanCode.substring(8, 11)}`;
        } else if (len === 12) {
            // В наших данных коды 12-значные: XX XXX XXX YYYY
            return `${cleanCode.substring(0, 2)} ${cleanCode.substring(2, 5)} ${cleanCode.substring(5, 8)} ${cleanCode.substring(8, 12)}`;
        }
        
        // Для любых других длин - просто добавляем пробелы через каждые 3 символа
        return code.replace(/(.{3})/g, '$1 ').trim();
    }
    
    // Получение типа объекта по коду типа
    function getObjectType(item) {
        if (item.isMunicipal) {
            // Типы муниципальных образований
            const municipalTypes = {
                0: 'муниципальное образование',
                1: 'муниципальный округ', 2: 'муниципальный район',
                3: 'городской округ с ВГД', 4: 'городской округ',
                5: 'внутригородской район', 6: 'внутригородская территория',
                7: 'городское поселение', 8: 'сельское поселение',
                9: 'межселенная территория', 10: 'округ',
                11: 'район', 12: 'поселение'
            };
            return municipalTypes[item.typeCode] || 'муниципальное образование';
        } else {
            // Типы населенных пунктов
            const settlementTypes = {
                0: 'неизвестно',
                1: 'город', 2: 'посёлок', 3: 'рабочий посёлок', 4: 'курортный посёлок',
                5: 'дачный посёлок', 6: 'городской посёлок', 10: 'село', 11: 'станица',
                12: 'деревня', 13: 'хутор', 14: 'аул', 15: 'кишлак',
                20: 'железнодорожная станция', 21: 'железнодорожный разъезд',
                22: 'железнодорожная будка', 23: 'железнодорожная казарма',
                24: 'железнодорожная платформа', 30: 'микрорайон', 31: 'поселение'
            };
            return settlementTypes[item.typeCode] || 'населённый пункт';
        }
    }

    // Вспомогательная функция: извлекает валидный 8/11-значный код из 9/12-значного
    function getValidOktmoCode(rawCode, recordType) {
        if (!rawCode) return '';
        
        // Для муниципалитетов (recordType = 1, длина 9) берем первые 8 знаков
        if (recordType === 1 && rawCode.length >= 8) {
            return rawCode.substring(0, 8);
        }
        // Для населенных пунктов (recordType = 2, длина 12) берем первые 11 знаков
        if (recordType === 2 && rawCode.length >= 11) {
            return rawCode.substring(0, 11);
        }
        // Запасной вариант
        return rawCode;
    }

    // Упрощенная версия форматирования (используется в parseDataItem)
    function formatValidCode(validCode) {
        if (!validCode) return '';
        
        if (validCode.length === 8) {
            return `${validCode.substring(0, 2)} ${validCode.substring(2, 5)} ${validCode.substring(5, 8)}`;
        } else if (validCode.length === 11) {
            return `${validCode.substring(0, 2)} ${validCode.substring(2, 5)} ${validCode.substring(5, 8)} ${validCode.substring(8, 11)}`;
        }
        
        return validCode;
    }
    
    // Функция для получения названия субъекта РФ по коду ОКТМО (первые 2 знака)
    // Основана на официальных данных. Для субъектов, не попавших в список, оставляет код.
    function getRealSubjectName(oktmoSubjectCode) {
        // Соответствие кодов и названий субъектов РФ по ОКТМО (том 1)
        // Данные взяты из classifikators.ru/oktmo и других официальных источников
        const oktmoSubjects = {
            // Центральный федеральный округ
            '14': 'Белгородская область', '15': 'Брянская область', '17': 'Владимирская область',
            '20': 'Воронежская область', '24': 'Ивановская область', '28': 'Тверская область',
            '29': 'Калужская область', '34': 'Костромская область', '38': 'Курская область',
            '42': 'Липецкая область', '45': 'Москва', '46': 'Московская область',
            '54': 'Орловская область', '61': 'Рязанская область', '66': 'Смоленская область',
            '68': 'Тамбовская область', '70': 'Тульская область', '78': 'Ярославская область',
            // Северо-Западный федеральный округ
            '11': 'Архангельская область', '19': 'Вологодская область', '27': 'Калининградская область',
            '40': 'Санкт-Петербург', '41': 'Ленинградская область', '47': 'Мурманская область',
            '49': 'Новгородская область', '58': 'Псковская область', '86': 'Республика Карелия',
            '87': 'Республика Коми',
            // Южный и Северо-Кавказский федеральные округа
            '03': 'Краснодарский край', '12': 'Астраханская область', '18': 'Волгоградская область',
            '35': 'Республика Крым', '60': 'Ростовская область', '67': 'Севастополь',
            '79': 'Республика Адыгея', '85': 'Республика Калмыкия',
            '07': 'Ставропольский край', '26': 'Республика Ингушетия',
            '82': 'Республика Дагестан', '83': 'Кабардино-Балкарская Республика',
            '90': 'Республика Северная Осетия — Алания', '91': 'Карачаево-Черкесская Республика',
            '96': 'Чеченская Республика',
            // Приволжский федеральный округ
            '22': 'Нижегородская область', '33': 'Кировская область', '36': 'Самарская область',
            '53': 'Оренбургская область', '56': 'Пензенская область', '57': 'Пермский край',
            '63': 'Саратовская область', '73': 'Ульяновская область', '80': 'Республика Башкортостан',
            '88': 'Республика Марий Эл', '89': 'Республика Мордовия', '92': 'Республика Татарстан',
            '94': 'Удмуртская Республика', '97': 'Чувашская Республика',
            // Уральский федеральный округ
            '37': 'Курганская область', '65': 'Свердловская область', '71': 'Тюменская область',
            '75': 'Челябинская область',
            // Сибирский федеральный округ
            '01': 'Алтайский край', '04': 'Красноярский край', '25': 'Иркутская область',
            '32': 'Кемеровская область — Кузбасс', '50': 'Новосибирская область',
            '52': 'Омская область', '69': 'Томская область', '84': 'Республика Алтай',
            '93': 'Республика Тыва', '95': 'Республика Хакасия',
            // Дальневосточный федеральный округ
            '05': 'Приморский край', '08': 'Хабаровский край', '10': 'Амурская область',
            '30': 'Камчатский край', '44': 'Магаданская область', '64': 'Сахалинская область',
            '76': 'Забайкальский край', '77': 'Чукотский автономный округ',
            '81': 'Республика Бурятия', '98': 'Республика Саха (Якутия)',
            '99': 'Еврейская автономная область'
            // Примечание: коды для новых территорий (21, 23, 43, 74) не включены для простоты.
        };

        return oktmoSubjects[oktmoSubjectCode] || `Субъект ${oktmoSubjectCode}`;
    }

    // Создает автоматический справочник названий субъектов РФ из данных
    function buildSubjectMapFromData() {
        console.log('🗺️ Построение карты субъектов РФ из данных...');
        
        const subjectMap = {};
        const processedSubjects = new Set();
        
        // Проходим по данным для поиска заголовков субъектов
        for (let i = 0; i < Math.min(oktmoData.length, 50000); i++) {
            const item = oktmoData[i];
            const rawCode = item[0];
            const name = item[1] || '';
            const recordType = item[2];
            
            // Ищем записи, которые выглядят как заголовки субъектов
            // Например: "Муниципальные образования Алтайского края"
            if (recordType === 1 && name && name.includes('Муниципальные образования')) {
                // Извлекаем код субъекта из кода (первые 2 знака)
                const validCode = getValidOktmoCode(rawCode, recordType);
                const subjectCode = validCode.substring(0, 2);
                
                // Извлекаем название субъекта из строки
                // Формат: "Муниципальные образования Алтайского края"
                let subjectName = name.replace('Муниципальные образования ', '');
                
                // Убираем возможные окончания
                subjectName = subjectName.trim();
                
                // Проверяем, что код и название извлечены корректно
                if (subjectCode && subjectName && !processedSubjects.has(subjectCode)) {
                    subjectMap[subjectCode] = subjectName;
                    processedSubjects.add(subjectCode);
                    
                    // Для отладки: выводим первые несколько найденных
                    if (Object.keys(subjectMap).length <= 5) {
                        console.log(`  📍 Найден субъект: ${subjectCode} - ${subjectName}`);
                    }
                }
            }
            
            // Ограничиваем, если нашли достаточное количество
            if (Object.keys(subjectMap).length > 85) break; // Все субъекты РФ
        }
        
        console.log(`✅ Построена карта из ${Object.keys(subjectMap).length} субъектов`);
        return subjectMap;
    }

    // Функция для получения названия субъекта из автоматически созданной карты
    function getSubjectNameFromData(subjectCode, subjectMap) {
        if (!subjectMap) return `Субъект ${subjectCode}`;
        return subjectMap[subjectCode] || `Субъект ${subjectCode}`;
    }
    
    // Инициализация фильтра субъектов РФ (с автоопределением из данных)
    function initSubjectFilter() {
        console.log('🔄 Инициализация фильтра субъектов (из данных)...');
        
        // 1. Строим карту субъектов из данных
        const subjectMap = buildSubjectMapFromData();
        
        // 2. Собираем уникальные коды субъектов из ВСЕХ записей
        const subjects = new Set();
        
        for (let i = 0; i < Math.min(oktmoData.length, 50000); i++) {
            const item = oktmoData[i];
            const rawCode = item[0];
            const recordType = item[2];
            
            // Пропускаем технические заголовки
            if (rawCode === '000000000' || rawCode === '000000000000') continue;
            
            // Получаем валидный код и извлекаем код субъекта
            const validCode = getValidOktmoCode(rawCode, recordType);
            if (validCode.length >= 2) {
                const subjectCode = validCode.substring(0, 2);
                if (subjectCode !== '00') {
                    subjects.add(subjectCode);
                }
            }
        }
        
        console.log(`📊 Найдено ${subjects.size} уникальных кодов субъектов`);
        
        // 3. Очищаем старые опции (кроме первой "Все субъекты")
        while (filterSubject.options.length > 1) {
            filterSubject.remove(1);
        }
        
        // 4. Добавляем новые опции, используя названия из карты
        const sortedSubjects = Array.from(subjects).sort();
        sortedSubjects.forEach(code => {
            const option = document.createElement('option');
            option.value = code;
            
            // Используем название из карты или показываем код
            const subjectName = getSubjectNameFromData(code, subjectMap);
            option.textContent = `${code} - ${subjectName}`;
            
            filterSubject.appendChild(option);
        });
        
        console.log(`✅ В фильтр загружено ${sortedSubjects.length} субъектов`);
    }
    
    // ==================== ПОИСК ====================
    
    // Основная функция поиска
    function performSearch(query) {
        console.log(`🔍 Поиск: "${query}"`);
        
        const trimmedQuery = query.trim();
        if (!trimmedQuery || trimmedQuery.length < 2) {
            return [];
        }
        
        const searchLower = trimmedQuery.toLowerCase();
        const isCodeSearch = /\d/.test(trimmedQuery);
        const cleanQuery = isCodeSearch ? trimmedQuery.replace(/[^\d]/g, '') : '';
        
        const showMunicipal = filterMunicipal.checked;
        const showSettlements = filterSettlements.checked;
        const selectedSubject = filterSubject.value;
        
        let results = [];
        let checkedCount = 0;
        const maxToCheck = 10000; // Ограничим для скорости
        
        // Простой поиск по первым N записям
        for (let i = 0; i < Math.min(oktmoData.length, maxToCheck); i++) {
            checkedCount++;
            
            const item = parseDataItem(i);
            if (!item) continue;
            
            // Пропускаем технические записи (разделы)
            if (item.code.startsWith('000') || item.name.includes('Раздел')) {
                continue;
            }
            
            // Фильтрация по типу объекта
            if (item.isMunicipal && !showMunicipal) continue;
            if (!item.isMunicipal && !showSettlements) continue;
            
            // Фильтрация по субъекту РФ
            if (selectedSubject && item.subjectCode !== selectedSubject) continue;
            
            // Поиск по коду
            if (isCodeSearch && cleanQuery) {
                if (item.code.startsWith(cleanQuery)) {
                    results.push(item);
                }
            }
            // Поиск по названию
            else if (item.name.toLowerCase().includes(searchLower)) {
                results.push(item);
            }
            // Поиск в дополнительной информации
            else if (item.additionalInfo && item.additionalInfo.toLowerCase().includes(searchLower)) {
                results.push(item);
            }
            
            // Ограничим количество результатов
            if (results.length >= 100) {
                break;
            }
        }
        
        console.log(`📊 Проверено: ${checkedCount} записей, найдено: ${results.length} результатов`);
        return results;
    }
    
    // ==================== ОТОБРАЖЕНИЕ РЕЗУЛЬТАТОВ ====================
    
    function displayResults(results, query) {
        console.log(`🖥️ Отображение результатов: ${results.length} записей`, results);

        console.log('✅ До добавления класса show:', resultsContainer.className);
        resultsContainer.classList.add('show');
        console.log('✅ После добавления класса show:', resultsContainer.className);
        console.log('✅ Классы контейнера:', resultsContainer.classList);
        
        resultsContainer.innerHTML = '';
        
        if (!query || query.length < 2 || results.length === 0) {
            console.log('❌ Нечего показывать:', { query, resultsLength: results.length });
            resultsContainer.classList.remove('show');
            
            if (query && query.length >= 2 && results.length === 0) {
                console.log('📝 Показываем сообщение "Ничего не найдено"');
                resultsContainer.classList.add('show');
                resultsContainer.innerHTML = `
                    <div class="no-results">
                        По запросу "<strong>${escapeHtml(query)}</strong>" ничего не найдено.<br>
                        Попробуйте другой запрос или проверьте фильтры.
                    </div>
                `;
            }
            return;
        }
        
        console.log('✅ Есть результаты для отображения');
        
        // Ограничим отображаемые результаты
        const displayResults = results.slice(0, 50);
        
        // Создаем HTML для результатов
        const resultsHtml = displayResults.map(item => {
            console.log('📝 Создаем HTML для записи:', item);
            const cssClass = item.isMunicipal ? 'municipal' : 'settlement';
            const objectType = getObjectType(item);
            
            return `
                <div class="result-item ${cssClass}">
                    <div class="result-code-container">
                        <span class="result-code">
                            ${item.formattedCode}
                        </span>
                        <span class="code-format-badge">
                            ${item.codeLength} знаков
                        </span>
                        
                        <button class="copy-btn action-btn" data-code="${item.code}" title="Копировать код">
                            📋
                        </button>
                        
                        <a href="https://ivo.garant.ru/#/basesearch/октмо%20${encodeURIComponent(item.formattedCode.replace(/\s/g, '%20'))}" 
                        class="action-btn" 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        title="Найти в системе ГАРАНТ">
                            🏛️
                        </a>
                    </div>
                    
                    <div class="result-name">${escapeHtml(item.name)}</div>
                    
                    <div class="result-type">
                        ${objectType}
                    </div>
                    
                    ${item.additionalInfo ? `
                        <div class="result-info">
                            ${escapeHtml(item.additionalInfo)}
                        </div>
                    ` : ''}
                    
                    ${item.isAdminCenter ? `
                        <div class="result-admin">
                            ⭐ Административный центр
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
        
        const resultsCountHtml = `
            <div class="results-count">
                По запросу "<strong>${escapeHtml(query)}</strong>" найдено: <strong>${results.length}</strong> записей
                ${results.length > 50 ? `(показано: ${displayResults.length})` : ''}
            </div>
        `;
        
        const moreResultsHtml = results.length > 50 ? `
            <div class="more-results">
                И ещё ${results.length - 50} записей...
            </div>
        ` : '';
        
        resultsContainer.innerHTML = resultsCountHtml + resultsHtml + moreResultsHtml;
        
        console.log('📋 HTML создан, добавляем в контейнер');
        console.log('Содержимое контейнера:', resultsContainer.innerHTML.length, 'символов');
        
        console.log('👁️ Проверка видимости контейнера...');
        console.log('Контейнер:', resultsContainer);
        console.log('OffsetHeight:', resultsContainer.offsetHeight);
        console.log('ClientHeight:', resultsContainer.clientHeight);
        console.log('Display style:', window.getComputedStyle(resultsContainer).display);
        console.log('Visibility style:', window.getComputedStyle(resultsContainer).visibility);
        console.log('Opacity style:', window.getComputedStyle(resultsContainer).opacity);

        // Принудительно покажем контейнер на всякий случай
        resultsContainer.style.display = 'block';
        resultsContainer.style.visibility = 'visible';
        resultsContainer.style.opacity = '1';

        console.log('📄 Созданный HTML:', resultsContainer.innerHTML.substring(0, 500) + '...');
        
        // Добавляем обработчики кнопок копирования
        setupCopyButtons();
        console.log('✅ Кнопки копирования настроены');
    }
    
    // Настройка кнопок копирования
    function setupCopyButtons() {
        document.querySelectorAll('.copy-btn').forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const codeToCopy = this.getAttribute('data-code');
                copyToClipboard(codeToCopy, this);
            });
        });
    }
    
    // Копирование в буфер обмена
    function copyToClipboard(text, button) {
        const originalHtml = button.innerHTML;
        
        navigator.clipboard.writeText(text)
            .then(() => {
                button.innerHTML = '✅';
                button.classList.add('copied');
                setTimeout(() => {
                    button.innerHTML = originalHtml;
                    button.classList.remove('copied');
                }, 1500);
            })
            .catch(err => {
                console.error('Ошибка копирования:', err);
                button.innerHTML = '❌';
                setTimeout(() => {
                    button.innerHTML = originalHtml;
                }, 1500);
            });
    }
    
    // Escape HTML для безопасности
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // ==================== ИНИЦИАЛИЗАЦИЯ ====================
    
    // Инициализация фильтров
    initSubjectFilter();
    
    // Обработчики событий для фильтров
    filterMunicipal.addEventListener('change', updateSearch);
    filterSettlements.addEventListener('change', updateSearch);
    filterSubject.addEventListener('change', updateSearch);
    
    // Обработчик поля поиска
    let searchTimeout;
    searchInput.addEventListener('input', function(e) {
        clearTimeout(searchTimeout);
        const query = e.target.value.trim();
        
        if (!query) {
            resultsContainer.classList.remove('show');
            resultsContainer.innerHTML = '';
            return;
        }
        
        searchTimeout = setTimeout(() => {
            updateSearch(query);
        }, 300);
    });
    
    // Обработчик Enter
    searchInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            clearTimeout(searchTimeout);
            updateSearch(e.target.value.trim());
        }
    });
    
    // Популярные запросы
    document.querySelectorAll('.query-tag').forEach(tag => {
        tag.addEventListener('click', function() {
            const query = this.textContent.trim();
            searchInput.value = query;
            searchInput.focus();
            updateSearch(query);
        });
    });
    
    // Функция обновления поиска
    function updateSearch(query) {
        const searchQuery = query || searchInput.value.trim();
        if (!searchQuery || searchQuery.length < 2) return;
        
        const results = performSearch(searchQuery);
        displayResults(results, searchQuery);
    }
    
    // Тестовый поиск при загрузке (для проверки)
    console.log('🔧 Тестовый поиск "Москва" для проверки работы...');
    setTimeout(() => {
        const testResults = performSearch("Москва");
        console.log(`🔧 Тестовый поиск завершен: ${testResults.length} результатов`);
        if (testResults.length > 0) {
            console.log('✅ Поиск работает! Пример:', testResults[0].name);
        }
    }, 500);
    
    console.log('✅ Справочник ОКТМО инициализирован. Готов к поиску!');
});