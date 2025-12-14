#!/usr/bin/env python3
"""
Конвертер CSV ОКТМО (официальный формат Росстата) в оптимизированный JSON/JS
Источник: https://rosstat.gov.ru/opendata/7708234640-oktmo
"""

import csv
import json
import os
import sys
from datetime import datetime

def detect_encoding(file_path):
    """
    Простая детекция кодировки windows-1251
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            f.read(1024)
        return 'utf-8'
    except UnicodeDecodeError:
        try:
            with open(file_path, 'r', encoding='windows-1251') as f:
                f.read(1024)
            return 'windows-1251'
        except:
            return 'utf-8-sig'

def parse_date(date_str):
    """
    Парсит дату из формата DD.MM.YYYY в YYYY-MM-DD
    """
    if not date_str or date_str.strip() == '':
        return "2014-01-01"
    
    try:
        date_str = date_str.strip().strip('"')
        
        for fmt in ('%d.%m.%Y', '%Y-%m-%d', '%d/%m/%Y'):
            try:
                dt = datetime.strptime(date_str, fmt)
                return dt.strftime('%Y-%m-%d')
            except ValueError:
                continue
        
        return "2014-01-01"
    except Exception:
        return "2014-01-01"

def clean_string(s):
    """
    Очистка строки от лишних пробелов и кавычек
    """
    if not s:
        return ""
    s = str(s).strip().strip('"').strip()
    while '  ' in s:
        s = s.replace('  ', ' ')
    return s

def extract_subject_name(name):
    """
    Извлекает название субъекта РФ из названия раздела
    Пример: "Муниципальные образования Алтайского края" -> "Алтайский край"
    """
    # Паттерны для извлечения
    patterns = [
        "Муниципальные образования ",
        "Населенные пункты, входящие в состав муниципальных образований ",
        "Раздел 1. Муниципальные образования ",
        "Раздел 2. Населенные пункты, входящие в состав муниципальных образований ",
    ]
    
    for pattern in patterns:
        if pattern in name:
            return name.replace(pattern, "")
    
    # Если не нашли паттерн, возвращаем как есть (но без "Раздел X.")
    if name.startswith("Раздел "):
        # Пытаемся найти точку или двоеточие
        if ":" in name:
            return name.split(":", 1)[1].strip()
        elif "." in name:
            parts = name.split(".", 1)
            if len(parts) > 1:
                return parts[1].strip()
    
    return name

def process_row(row):
    """
    Обрабатывает строку CSV и возвращает оптимизированный массив
    """
    try:
        ter = clean_string(row[0]) if len(row) > 0 else ""
        kod1 = clean_string(row[1]) if len(row) > 1 else ""
        kod2 = clean_string(row[2]) if len(row) > 2 else ""
        kod3 = clean_string(row[3]) if len(row) > 3 else ""
        kc = clean_string(row[4]) if len(row) > 4 else ""
        razdel = clean_string(row[5]) if len(row) > 5 else ""
        name1 = clean_string(row[6]) if len(row) > 6 else ""
        centrum = clean_string(row[7]) if len(row) > 7 else ""
        date_vved = clean_string(row[12]) if len(row) > 12 else ""
        
        # Определяем тип записи
        if "Раздел" in name1 and "Муниципальные образования" in name1 and "Населенные пункты" not in name1:
            record_type = 0  # Раздел субъекта (МО)
        elif "Раздел" in name1 and "Населенные пункты" in name1:
            record_type = 0  # Раздел субъекта (населенные пункты)
        elif razdel == '1':
            record_type = 1  # Муниципальное образование
        elif razdel == '2':
            record_type = 2  # Населенный пункт
        else:
            # По умолчанию считаем разделом
            record_type = 0
        
        # Формируем полный код (БЕЗ контрольного числа!)
        full_code = ""
        ter_padded = ter.zfill(2) if ter else "00"
        kod1_padded = kod1.zfill(3) if kod1 else "000"
        kod2_padded = kod2.zfill(3) if kod2 else "000"
        kod3_padded = kod3.zfill(3) if kod3 else "000"
        
        if record_type == 1:  # МО - 8 знаков
            # TER(2) + KOD1(3) + KOD2(3) = 8 знаков
            full_code = f"{ter_padded}{kod1_padded}{kod2_padded}"
        elif record_type == 2:  # Населенный пункт - 11 знаков
            # TER(2) + KOD1(3) + KOD2(3) + KOD3(3) = 11 знаков
            full_code = f"{ter_padded}{kod1_padded}{kod2_padded}{kod3_padded}"
        else:  # Раздел
            # Для разделов тоже формируем код для поиска
            if ter_padded != "00":
                full_code = f"{ter_padded}000000"  # 8 знаков
            else:
                full_code = "00000000"  # Общие разделы
        
        # Парсим дату
        date_parsed = parse_date(date_vved)
        
        # Формируем итоговый массив
        result = [
            full_code,          # 0: полный код (8 или 11 знаков) БЕЗ контрольного числа
            name1,              # 1: название
            record_type,        # 2: тип (0,1,2)
            ter_padded,         # 3: код субъекта (2 цифры)
            centrum,            # 4: административный центр
            date_parsed,        # 5: дата введения
            kc                  # 6: контрольное число (сохраняем отдельно)
        ]
        
        # Проверяем валидность кода
        if not full_code:
            return None
            
        return result
        
    except Exception as e:
        print(f"Ошибка обработки строки: {e}")
        return None

def generate_subject_dict(data):
    """
    Генерирует словарь субъектов РФ из данных
    Ищет записи типа "Муниципальные образования <Название субъекта>"
    """
    subjects = {}
    
    # Сначала собираем все уникальные записи раздела субъектов
    for item in data:
        if item and len(item) > 2:
            name = item[1]
            subject_code = item[3]
            
            # Ищем записи, которые содержат названия субъектов
            if (subject_code != "00" and 
                ("Муниципальные образования" in name or 
                 "Населенные пункты" in name)):
                
                # Извлекаем название субъекта
                subject_name = extract_subject_name(name)
                
                # Если название содержит только название субъекта (не содержит "Раздел" и т.п.)
                if ("Раздел" not in subject_name and 
                    "Муниципальные образования" not in subject_name and
                    "Населенные пункты" not in subject_name):
                    
                    subjects[subject_code] = subject_name
    
    # Если некоторые субъекты не нашлись, оставляем код
    # Дополняем недостающие коды
    for item in data:
        if item and len(item) > 3:
            subject_code = item[3]
            if subject_code != "00" and subject_code not in subjects:
                # Ищем любое название для этого субъекта
                for item2 in data:
                    if (item2 and len(item2) > 3 and 
                        item2[3] == subject_code and 
                        item2[1] and len(item2[1]) > 5):
                        # Берем первое попавшееся название, удаляя префиксы
                        name = item2[1]
                        for prefix in ["г ", "с ", "п ", "д ", "рп "]:
                            if name.startswith(prefix):
                                name = name[len(prefix):]
                                break
                        subjects[subject_code] = name
                        break
    
    # Сортируем по коду
    return dict(sorted(subjects.items()))

def convert_csv_to_js(input_file, output_file):
    """
    Основная функция конвертации
    """
    print(f"Конвертация {input_file} -> {output_file}")
    
    encoding = detect_encoding(input_file)
    print(f"Определена кодировка: {encoding}")
    
    data = []
    processed_count = 0
    skipped_count = 0
    
    try:
        with open(input_file, 'r', encoding=encoding) as f:
            reader = csv.reader(f, delimiter=';', quotechar='"')
            
            for i, row in enumerate(reader):
                if not row or len(row) < 7:
                    skipped_count += 1
                    continue
                
                processed_row = process_row(row)
                
                if processed_row:
                    data.append(processed_row)
                    processed_count += 1
                else:
                    skipped_count += 1
                
                if i % 50000 == 0 and i > 0:
                    print(f"Обработано {i} строк...")
    
    except Exception as e:
        print(f"Ошибка чтения файла: {e}")
        sys.exit(1)
    
    print(f"\nОбработка завершена:")
    print(f"  Успешно обработано: {processed_count}")
    print(f"  Пропущено: {skipped_count}")
    print(f"  Всего записей: {len(data)}")
    
    if not data:
        print("Нет данных для сохранения!")
        sys.exit(1)
    
    # Генерируем словарь субъектов
    subjects = generate_subject_dict(data)
    print(f"\nНайдено субъектов РФ: {len(subjects)}")
    
    # Типы записей
    type_names = {
        0: "Раздел",
        1: "Муниципальное образование",
        2: "Населенный пункт"
    }
    
    # Сохраняем как JavaScript файл
    try:
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write("// Данные ОКТМО (оптимизированный формат)\n")
            f.write("// Источник: https://rosstat.gov.ru/opendata/7708234640-oktmo\n")
            f.write("// Сгенерировано: " + datetime.now().strftime("%Y-%m-%d %H:%M:%S") + "\n\n")
            
            f.write("const oktmoData = ")
            json.dump(data, f, ensure_ascii=False, separators=(',', ':'))
            f.write(";\n\n")
            
            f.write("const oktmoMetadata = ")
            json.dump({
                "subjects": subjects,
                "types": type_names,
                "generated": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                "total": len(data)
            }, f, ensure_ascii=False, separators=(',', ':'))
            f.write(";\n\n")
            
            f.write("// Экспорт для использования\n")
            f.write("if (typeof module !== 'undefined' && module.exports) {\n")
            f.write("    module.exports = { oktmoData, oktmoMetadata };\n")
            f.write("}\n")
        
        print(f"\nФайл сохранен: {output_file}")
        
        # Статистика по типам
        type_counts = {0: 0, 1: 0, 2: 0}
        for item in data:
            if item and len(item) > 2:
                t = item[2]
                if t in type_counts:
                    type_counts[t] += 1
        
        print("\nСтатистика по типам:")
        print(f"  Разделы: {type_counts[0]}")
        print(f"  Муниципальные образования: {type_counts[1]}")
        print(f"  Населенные пункты: {type_counts[2]}")
        
        # Примеры первых 5 записей
        print("\nПримеры записей (первые 5):")
        for i, item in enumerate(data[:5]):
            print(f"  {i+1}. Код: {item[0]}, Название: {item[1][:50]}..., Тип: {item[2]}, Субъект: {item[3]}")
        
        # Примеры разделов субъектов
        print("\nПримеры субъектов РФ:")
        for i, (code, name) in enumerate(list(subjects.items())[:10]):
            print(f"  {code}: {name}")
        
    except Exception as e:
        print(f"Ошибка сохранения файла: {e}")
        sys.exit(1)

def main():
    """
    Основная функция
    """
    input_file = "oktmo.csv"
    output_file = "data.js"
    
    if len(sys.argv) > 1:
        input_file = sys.argv[1]
    if len(sys.argv) > 2:
        output_file = sys.argv[2]
    
    if not os.path.exists(input_file):
        print(f"Ошибка: файл {input_file} не найден!")
        print("Скачайте файл с https://rosstat.gov.ru/opendata/7708234640-oktmo")
        print("Или укажите путь к файлу: python convert_to_json.py <input.csv> [output.js]")
        sys.exit(1)
    
    convert_csv_to_js(input_file, output_file)

if __name__ == "__main__":
    main()