/**
 * Интерактивный справочник ОКТМО
 * Основной скрипт для поиска и отображения данных
 */

// DOM элементы
const searchInput = document.getElementById('searchInput');
const resultsContainer = document.getElementById('resultsContainer');
const noResults = document.getElementById('noResults');
const resultsCount = document.getElementById('resultsCount');
const countSpan = document.querySelector('.count');
const shownSpan = document.querySelector('.shown');
const showAllBtn = document.getElementById('showAllBtn');
const filterMunicipal = document.getElementById('filterMunicipal');
const filterSettlements = document.getElementById('filterSettlements');
const filterSubject = document.getElementById('filterSubject');
const queryTags = document.querySelectorAll('.query-tag');

// Настройки
const DEFAULT_SHOW_LIMIT = 50;
let currentShowLimit = DEFAULT_SHOW_LIMIT;
let debounceTimer;

// Преобразуем данные в удобный формат при загрузке
let formattedData = [];
let allSubjects = {};

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    console.log('Инициализация справочника ОКТМО...');
    
    try {
        // Форматируем данные
        formattedData = oktmoData.map(item => ({
            code: item[0],        // код без пробелов (8 или 11 знаков)
            name: item[1],        // название
            type: item[2],        // тип: 0=раздел, 1=МО, 2=населенный пункт
            subject: item[3],     // код субъекта (2 цифры)
            center: item[4],      // административный центр (для МО)
            date: item[5],        // дата введения
            check: item[6]        // контрольное число
        })).filter(item => item.type === 1 || item.type === 2); // Фильтруем только МО и населенные пункты
        
        console.log(`Данные загружены: ${formattedData.length} записей`);
        
        // Инициализация фильтров
        initFilters();
        
        // Настройка обработчиков событий
        setupEventListeners();
        
        // Показываем начальное состояние
        updateResultsUI([], 'initial');
        
    } catch (error) {
        console.error('Ошибка инициализации:', error);
        showError('Ошибка загрузки данных. Пожалуйста, обновите страницу.');
    }
});

// Инициализация фильтров
function initFilters() {
    // Заполняем выпадающий список субъектов
    if (oktmoMetadata && oktmoMetadata.subjects) {
        allSubjects = oktmoMetadata.subjects;
        
        // Сортируем субъекты по названию
        const sortedSubjects = Object.entries(allSubjects)
            .sort((a, b) => a[1].localeCompare(b[1]));
        
        // Добавляем опции в select
        sortedSubjects.forEach(([code, name]) => {
            const option = document.createElement('option');
            option.value = code;
            option.textContent = `${code} - ${name}`;
            filterSubject.appendChild(option);
        });
    }
    
    // Настройка популярных запросов
    queryTags.forEach(tag => {
        tag.addEventListener('click', () => {
            searchInput.value = tag.textContent;
            performSearch();
        });
    });
}

// Настройка обработчиков событий
function setupEventListeners() {
    // Поиск при вводе (с debounce)
    searchInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(performSearch, 300);
    });
    
    // Фильтры
    filterMunicipal.addEventListener('change', performSearch);
    filterSettlements.addEventListener('change', performSearch);
    filterSubject.addEventListener('change', performSearch);
    
    // Кнопка "Показать все"
    showAllBtn.addEventListener('click', () => {
        currentShowLimit = Infinity;
        performSearch();
    });
    
    // Обработка Enter в поле поиска
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            performSearch();
        }
    });
}

// Основная функция поиска
function performSearch() {
    const searchTerm = searchInput.value.trim();
    const searchType = determineSearchType(searchTerm);
    
    console.log(`Поиск: "${searchTerm}", тип: ${searchType}`);
    
    // Фильтруем данные по типу объекта
    let filteredByType = filterByObjectType(formattedData);
    
    // Фильтруем по субъекту
    let filteredBySubject = filterBySubject(filteredByType);
    
    // Выполняем поиск
    let searchResults = [];
    
    if (searchTerm) {
        searchResults = filteredBySubject.filter(item => {
            switch (searchType) {
                case 'code':
                    return searchByCode(item, searchTerm);
                case 'name':
                    return searchByName(item, searchTerm);
                default:
                    return searchByCode(item, searchTerm) || searchByName(item, searchTerm);
            }
        });
    } else {
        // Если нет поискового запроса, показываем отфильтрованные данные
        searchResults = filteredBySubject.slice(0, 100); // Ограничиваем для производительности
    }
    
    // Обновляем интерфейс
    updateResultsUI(searchResults, searchTerm);
}

// Определение типа поиска (по коду или названию)
function determineSearchType(term) {
    if (!term) return 'none';
    
    // Проверяем, содержит ли строка только цифры, точки и пробелы
    const codePattern = /^[\d\s\.]+$/;
    if (codePattern.test(term)) {
        return 'code';
    }
    
    // Проверяем, начинается ли с типичных префиксов для названий населенных пунктов
    const namePrefixes = ['г ', 'с ', 'п ', 'д ', 'рп ', 'пос ', 'гор ', 'деревня ', 'село '];
    if (namePrefixes.some(prefix => term.toLowerCase().startsWith(prefix))) {
        return 'name';
    }
    
    return 'mixed';
}

// Фильтрация по типу объекта
function filterByObjectType(data) {
    const showMunicipal = filterMunicipal.checked;
    const showSettlements = filterSettlements.checked;
    
    return data.filter(item => {
        if (item.type === 1 && showMunicipal) return true; // МО
        if (item.type === 2 && showSettlements) return true; // Населенные пункты
        return false;
    });
}

// Фильтрация по субъекту РФ
function filterBySubject(data) {
    const selectedSubject = filterSubject.value;
    if (!selectedSubject) return data;
    
    return data.filter(item => item.subject === selectedSubject);
}

// Поиск по коду (префиксный)
function searchByCode(item, searchTerm) {
    const cleanTerm = searchTerm.replace(/[\s\.]/g, '');
    const itemCode = item.code;
    
    // Префиксный поиск: код должен начинаться с поискового запроса
    return itemCode.startsWith(cleanTerm);
}

// Поиск по названию (подстрока)
function searchByName(item, searchTerm) {
    const searchLower = searchTerm.toLowerCase();
    const itemNameLower = item.name.toLowerCase();
    
    // Если несколько слов через пробел - ищем все слова
    const words = searchLower.split(/\s+/).filter(word => word.length > 0);
    
    if (words.length === 1) {
        // Одно слово - просто ищем подстроку
        return itemNameLower.includes(searchLower);
    } else {
        // Несколько слов - все должны встречаться в названии
        return words.every(word => itemNameLower.includes(word));
    }
}

// Обновление интерфейса с результатами
function updateResultsUI(results, searchTerm) {
    const totalResults = results.length;
    const showResults = results.slice(0, currentShowLimit);
    const shownCount = Math.min(totalResults, currentShowLimit);
    
    // Обновляем счетчик
    countSpan.textContent = totalResults;
    shownSpan.textContent = shownCount;
    
    // Скрываем/показываем кнопку "Показать все"
    if (totalResults > DEFAULT_SHOW_LIMIT && currentShowLimit === DEFAULT_SHOW_LIMIT) {
        showAllBtn.style.display = 'block';
    } else {
        showAllBtn.style.display = 'none';
        currentShowLimit = DEFAULT_SHOW_LIMIT;
    }
    
    // Очищаем контейнер
    resultsContainer.innerHTML = '';
    
    if (totalResults === 0) {
        // Нет результатов
        if (searchTerm && searchTerm !== 'initial') {
            resultsContainer.innerHTML = `
                <div class="no-results">
                    <p>По запросу <strong>"${escapeHtml(searchTerm)}"</strong> ничего не найдено.</p>
                    <p><em>Попробуйте:</em></p>
                    <ul>
                        <li>Упростить запрос (например, "Москва" вместо "г Москва")</li>
                        <li>Проверить правильность написания</li>
                        <li>Искать только по части кода (например, "01" или "01512")</li>
                        <li>Снять фильтры в блоке выше</li>
                    </ul>
                </div>
            `;
        }
        resultsContainer.classList.remove('show');
        return;
    }
    
    // Показываем контейнер
    resultsContainer.classList.add('show');
    
    // Добавляем сообщение о количестве результатов
    const resultsHeader = document.createElement('div');
    resultsHeader.className = 'results-header';
    resultsHeader.innerHTML = `
        <div class="results-count">
            Найдено <strong>${totalResults}</strong> записей ${searchTerm && searchTerm !== 'initial' ? `по запросу "${escapeHtml(searchTerm)}"` : ''}
        </div>
    `;
    resultsContainer.appendChild(resultsHeader);
    
    // Создаем таблицу для результатов
    const table = document.createElement('table');
    table.className = 'results-table';
    table.innerHTML = `
        <thead>
            <tr>
                <th width="120">Код ОКТМО</th>
                <th>Наименование</th>
                <th width="200">Информация</th>
                <th width="150">Действия</th>
            </tr>
        </thead>
        <tbody id="resultsBody"></tbody>
    `;
    resultsContainer.appendChild(table);
    
    const resultsBody = document.getElementById('resultsBody');
    
    // Заполняем таблицу
    showResults.forEach(item => {
        const row = createResultRow(item, searchTerm);
        resultsBody.appendChild(row);
    });
    
    // Добавляем сообщение о пагинации
    if (totalResults > shownCount) {
        const moreResults = document.createElement('div');
        moreResults.className = 'more-results';
        moreResults.innerHTML = `
            <p>Показано ${shownCount} из ${totalResults} результатов. 
            <button id="loadMoreBtn" class="show-all-btn">Показать все ${totalResults} записей</button></p>
        `;
        resultsContainer.appendChild(moreResults);
        
        document.getElementById('loadMoreBtn').addEventListener('click', () => {
            currentShowLimit = Infinity;
            performSearch();
        });
    }
}

// Создание строки результата - ОБНОВЛЕННАЯ ВЕРСИЯ
function createResultRow(item, searchTerm) {
    const row = document.createElement('tr');
    row.className = `result-item ${item.type === 1 ? 'municipal' : 'settlement'}`;
    
    // Форматируем код с пробелами
    const formattedCode = formatOktmoCode(item.code);
    
    // Определяем название субъекта
    const subjectName = allSubjects[item.subject] || `Субъект ${item.subject}`;
    
    // Определяем тип объекта
    const typeName = item.type === 1 ? 'МО' : 'Населенный пункт';
    const typeClass = item.type === 1 ? 'municipal-type' : 'settlement-type';
    
    // Подсветка совпадений в коде
    let highlightedCode = formattedCode;
    if (searchTerm && determineSearchType(searchTerm) === 'code') {
        const cleanTerm = searchTerm.replace(/[\s\.]/g, '');
        highlightedCode = highlightMatch(formattedCode, cleanTerm);
    }
    
    // Подсветка совпадений в названии
    let highlightedName = item.name;
    if (searchTerm && determineSearchType(searchTerm) !== 'code') {
        highlightedName = highlightMatch(item.name, searchTerm);
    }
    
    // УБРАНО: код бейджа типа кода (было: codeBadgeClass, codeBadgeText)
    
    // Компактное отображение названия (с ограничением по высоте)
    const displayName = item.name.length > 60 ? 
        item.name.substring(0, 57) + '...' : 
        item.name;
    
    row.innerHTML = `
        <td>
            <div class="result-code-container" data-tooltip="${item.type === 1 ? 'Муниципальное образование (8 знаков)' : 'Населенный пункт (11 знаков)'}">
                <span class="result-code">${highlightedCode}</span>
            </div>
        </td>
        <td>
            <div class="result-name result-name-compact" title="${item.name}">${highlightedName}</div>
            ${item.center ? `<div class="result-center-compact" title="Административный центр">🏛️ ${item.center}</div>` : ''}
        </td>
        <td>
            <div class="result-details-compact">
                <span class="result-detail-compact ${typeClass}" title="Тип объекта">
                    ${item.type === 1 ? '🏢' : '🏠'} ${typeName}
                </span>
                <span class="result-detail-compact subject" title="Субъект РФ">
                    📍 ${subjectName.substring(0, 15)}${subjectName.length > 15 ? '...' : ''}
                </span>
            </div>
            <div class="result-details-compact">
                <span class="result-detail-compact date" title="Дата введения">
                    📅 ${item.date}
                </span>
            </div>
        </td>
        <td>
            <div class="result-actions-compact">
                <button class="action-btn-compact copy-btn" title="Копировать код ${item.code}" data-code="${item.code}">
                    <span class="btn-icon">📋</span>
                    <span class="btn-text">Копировать</span>
                </button>
                ${item.type === 2 ? `
                    <button class="action-btn-compact parent-btn" title="Найти муниципалитет ${item.code.substring(0, 8)}" data-parent="${item.code.substring(0, 8)}">
                        <span class="btn-icon">🔍</span>
                        <span class="btn-text">МО</span>
                    </button>
                ` : ''}
                <a href="https://ivo.garant.ru/#/basesearch/октмо%20${encodeURIComponent(formattedCode)}" 
                   target="_blank" 
                   class="action-btn-compact garant-btn" 
                   title="Поиск в системе ГАРАНТ">
                    <span class="btn-icon">🏛️</span>
                    <span class="btn-text">ГАРАНТ</span>
                </a>
            </div>
        </td>
    `;
    
    // Добавляем обработчики для кнопок
    const copyBtn = row.querySelector('.copy-btn');
    const parentBtn = row.querySelector('.parent-btn');
    
    copyBtn.addEventListener('click', () => copyToClipboard(item.code, copyBtn));
    
    if (parentBtn) {
        parentBtn.addEventListener('click', () => {
            const parentCode = parentBtn.getAttribute('data-parent');
            searchInput.value = parentCode;
            performSearch();
        });
    }
    
    return row;
}

// Форматирование кода ОКТМО с пробелами
function formatOktmoCode(code) {
    if (!code) return '';
    
    if (code.length === 8) {
        // Муниципальное образование: XX XXX XXX
        return `${code.substring(0, 2)} ${code.substring(2, 5)} ${code.substring(5, 8)}`;
    } else if (code.length === 11) {
        // Населенный пункт: XX XXX XXX XXX
        return `${code.substring(0, 2)} ${code.substring(2, 5)} ${code.substring(5, 8)} ${code.substring(8, 11)}`;
    }
    
    return code;
}

// Подсветка совпадений в тексте
function highlightMatch(text, searchTerm) {
    if (!searchTerm || !text) return escapeHtml(text);
    
    const searchLower = searchTerm.toLowerCase();
    const textStr = String(text);
    
    // Убираем форматирование из кода для поиска
    const cleanText = textStr.replace(/\s/g, '');
    const cleanTerm = searchLower.replace(/[\s\.]/g, '');
    
    if (cleanText.toLowerCase().includes(cleanTerm)) {
        // Для кодов ищем цифры
        if (/^\d+$/.test(cleanTerm)) {
            const regex = new RegExp(`(${cleanTerm})`, 'gi');
            return textStr.replace(regex, '<mark class="code-match">$1</mark>');
        }
    }
    
    // Для названий
    const regex = new RegExp(`(${searchLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return textStr.replace(regex, '<mark>$1</mark>');
}

// Копирование в буфер обмена
function copyToClipboard(text, button) {
    navigator.clipboard.writeText(text).then(() => {
        const originalText = button.textContent;
        button.textContent = '✓ Скопировано!';
        button.classList.add('copied');
        
        setTimeout(() => {
            button.textContent = originalText;
            button.classList.remove('copied');
        }, 2000);
    }).catch(err => {
        console.error('Ошибка копирования:', err);
        alert('Не удалось скопировать код. Пожалуйста, скопируйте вручную: ' + text);
    });
}

// Экранирование HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Показ ошибки
function showError(message) {
    resultsContainer.innerHTML = `
        <div class="no-results error">
            <p style="color: #d32f2f;">❌ ${message}</p>
        </div>
    `;
    resultsContainer.classList.add('show');
}

// Экспорт для тестирования
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        determineSearchType,
        searchByCode,
        searchByName,
        formatOktmoCode,
        highlightMatch
    };
}