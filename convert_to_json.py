import csv
import json
import re
from datetime import datetime

def try_decode_file(file_path):
    """Пробуем разные кодировки для русского текста"""
    encodings_to_try = [
        'utf-8',
        'utf-8-sig',
        'windows-1251',
        'cp1251',
        'iso-8859-5',
        'koi8-r',
        'cp866',
        'mac_cyrillic'
    ]
    
    for encoding in encodings_to_try:
        try:
            with open(file_path, 'r', encoding=encoding) as f:
                lines = []
                for i in range(3):
                    line = f.readline()
                    if line:
                        lines.append(line)
                
                test_text = ''.join(lines)
                cyrillic_chars = set('абвгдеёжзийклмнопрстуфхцчшщъыьэюя')
                found_cyrillic = any(char in test_text.lower() for char in cyrillic_chars)
                
                if found_cyrillic and '�' not in test_text:
                    print(f"✅ Найдена рабочая кодировка: {encoding}")
                    return encoding
                    
        except UnicodeDecodeError:
            continue
    
    print("❌ Не удалось определить кодировку автоматически")
    return None

def clean_code_part(part):
    """Очищает часть кода от лишних символов"""
    if not part:
        return "000"
    clean = re.sub(r'[^0-9]', '', str(part))
    return clean.zfill(3)

def get_settlement_type_code(name):
    """Возвращает код типа населенного пункта (1 байт)"""
    if not name:
        return 0  # неизвестно
    
    name_lower = name.lower()
    
    # Коды типов (можно изменить при необходимости)
    type_codes = {
        # Города и посёлки
        'г ': 1, 'город': 1, 'гор.': 1, 'г.': 1,
        'п ': 2, 'посёлок': 2, 'пос.': 2, 'п.': 2,
        'рп ': 3, 'рабочий посёлок': 3,
        'кп ': 4, 'курортный посёлок': 4,
        'дп ': 5, 'дачный посёлок': 5,
        'гп ': 6, 'городской посёлок': 6,
        
        # Сельские населенные пункты
        'с ': 10, 'село': 10, 'с.': 10,
        'ст-ца ': 11, 'станица': 11,
        'д ': 12, 'деревня': 12, 'д.': 12,
        'хут ': 13, 'хутор': 13,
        'аул ': 14, 'аул': 14,
        'киш ': 15, 'кишлак': 15,
        
        # Железнодорожные объекты
        'ж/д ст ': 20, 'железнодорожная станция': 20,
        'ж/д рзд ': 21, 'железнодорожный разъезд': 21,
        'ж/д будка ': 22, 'железнодорожная будка': 22,
        'ж/д казарма ': 23, 'железнодорожная казарма': 23,
        'ж/д пл ': 24, 'железнодорожная платформа': 24,
        
        # Прочие
        'мкр ': 30, 'микрорайон': 30,
        'пос ': 31, 'поселение': 31
    }
    
    for prefix, code in type_codes.items():
        if name_lower.startswith(prefix):
            return code
    
    # Проверяем содержание ключевых слов
    if any(word in name_lower for word in ['город', 'гор.', 'г.']):
        return 1
    elif any(word in name_lower for word in ['село', 'с.', 'с ']):
        return 10
    elif any(word in name_lower for word in ['посёлок', 'пос.', 'п.', 'п ']):
        return 2
    elif 'станица' in name_lower:
        return 11
    elif 'деревня' in name_lower or 'д.' in name_lower or 'д ' in name_lower:
        return 12
    
    return 0  # неизвестно

def get_municipal_type_code(name):
    """Возвращает код типа муниципального образования (1 байт)"""
    if not name:
        return 0
    
    name_lower = name.lower()
    
    # Коды типов муниципальных образований
    if 'муниципальный округ' in name_lower:
        return 1
    elif 'муниципальный район' in name_lower:
        return 2
    elif 'городской округ с внутригородским делением' in name_lower:
        return 3
    elif 'городской округ' in name_lower:
        return 4
    elif 'внутригородской район' in name_lower:
        return 5
    elif 'внутригородская территория' in name_lower:
        return 6
    elif 'городское поселение' in name_lower:
        return 7
    elif 'сельское поселение' in name_lower:
        return 8
    elif 'межселенная территория' in name_lower:
        return 9
    elif 'округ' in name_lower:
        return 10
    elif 'район' in name_lower:
        return 11
    elif 'поселение' in name_lower:
        return 12
    
    return 0

def parse_date(date_str):
    """Парсит дату в числовой формат (YYYYMMDD)"""
    if not date_str:
        return 0
    
    try:
        # Пробуем разные форматы
        for fmt in ['%d.%m.%Y', '%Y-%m-%d', '%d/%m/%Y']:
            try:
                dt = datetime.strptime(date_str, fmt)
                return int(dt.strftime('%Y%m%d'))
            except ValueError:
                continue
    except:
        pass
    
    return 0

def convert_oktmo_csv_to_json(input_file, output_file):
    """Конвертирует CSV ОКТМО в оптимизированный JSON"""
    
    print("🔧 Конвертация ОКТМО CSV в оптимизированный JSON")
    print("=" * 50)
    
    encoding = try_decode_file(input_file)
    if not encoding:
        return
    
    data = []
    
    try:
        with open(input_file, 'r', encoding=encoding) as f:
            first_line = f.readline()
            f.seek(0)
            
            delimiter = ';' if ';' in first_line else ','
            print(f"📁 Используем разделитель: '{delimiter}'")
            
            reader = csv.reader(f, delimiter=delimiter, quotechar='"')
            
            processed_count = 0
            skipped_count = 0
            
            for i, row in enumerate(reader):
                if not any(row):
                    continue
                
                # Нормализуем строку
                row = [cell.strip().strip('"').strip("'") for cell in row]
                
                if len(row) < 7:
                    skipped_count += 1
                    continue
                
                # Извлекаем только необходимые данные
                col1 = clean_code_part(row[0])
                col2 = clean_code_part(row[1])
                col3 = clean_code_part(row[2])
                col4 = clean_code_part(row[3])
                record_type = row[5] if len(row) > 5 else "0"
                name = row[6] if len(row) > 6 else ""
                
                if not name or name.isspace():
                    skipped_count += 1
                    continue
                
                # Формируем код
                if record_type == "1":
                    # Муниципальное образование - 8 знаков
                    code = col1 + col2 + col3
                    code_len = 8
                    is_municipal = True
                    type_code = get_municipal_type_code(name)
                else:
                    # Населенный пункт - 11 знаков
                    code = col1 + col2 + col3 + col4
                    code_len = 11
                    is_municipal = False
                    type_code = get_settlement_type_code(name)
                
                # Дополнительная информация (административный центр)
                additional_info = row[7] if len(row) > 7 else ""
                
                # Определяем, является ли административным центром
                # Простая проверка - если дополнительная информация не пустая
                # и она как-то связана с названием
                is_admin = 1 if (additional_info and 
                               (additional_info.lower() in name.lower() or 
                                name.lower() in additional_info.lower())) else 0
                
                # Статус и даты
                status_code = row[9] if len(row) > 9 else "000"
                effective_date_str = row[12] if len(row) > 12 else ""
                effective_date = parse_date(effective_date_str)
                
                # ОПТИМИЗИРОВАННАЯ структура записи:
                # Порядок полей важен для сжатия
                record = [
                    code,                    # 0: код (8 или 11 символов)
                    name,                    # 1: название
                    int(record_type),        # 2: тип записи (1 или 2)
                    type_code,               # 3: код типа объекта
                    is_admin,                # 4: является ли адм. центром (0/1)
                    status_code,             # 5: код статуса
                    effective_date,          # 6: дата вступления в силу
                    additional_info[:50] if additional_info else ""  # 7: доп. инфа (обрезанная)
                ]
                
                data.append(record)
                processed_count += 1
                
                if processed_count % 50000 == 0:
                    print(f"📊 Обработано записей: {processed_count}")
    
    except Exception as e:
        print(f"❌ Ошибка при обработке файла: {e}")
        import traceback
        traceback.print_exc()
        return
    
    # Сохраняем в компактном формате
    try:
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write('// Данные справочника ОКТМО (ОК 033-2013)\n')
            f.write('// Оптимизированная версия\n')
            f.write('// Источник: classifikators.ru\n\n')
            f.write('const oktmoData = ')
            # Минимальный формат JSON (без пробелов)
            json.dump(data, f, ensure_ascii=False, separators=(',', ':'))
            f.write(';')
        
        print(f"\n✅ Конвертация завершена успешно!")
        print(f"   Обработано записей: {processed_count}")
        print(f"   Пропущено строк: {skipped_count}")
        
        # Анализ размера
        import os
        original_size = os.path.getsize(input_file)
        optimized_size = os.path.getsize(output_file)
        compression_ratio = original_size / optimized_size if optimized_size > 0 else 0
        
        print(f"\n📊 Анализ размера:")
        print(f"   Исходный CSV: {original_size:,} байт")
        print(f"   Оптимизированный JSON: {optimized_size:,} байт")
        print(f"   Коэффициент сжатия: {compression_ratio:.1f}x")
        
        # Пример записи
        print(f"\n📋 Пример записи:")
        if data:
            example = data[0]
            print(f"   Код: {example[0]}")
            print(f"   Название: {example[1][:50]}...")
            print(f"   Тип: {'муниципальное образование' if example[2] == 1 else 'населенный пункт'}")
            print(f"   Код типа: {example[3]}")
            
        # Статистика по типам
        print(f"\n📊 Статистика:")
        municipal_count = sum(1 for r in data if r[2] == 1)
        settlement_count = sum(1 for r in data if r[2] == 2)
        print(f"   Муниципальные образования: {municipal_count}")
        print(f"   Населенные пункты: {settlement_count}")
        
        # Подсчет уникальных типов
        type_counts = {}
        for r in data:
            t = r[3]
            type_counts[t] = type_counts.get(t, 0) + 1
        
        print(f"\n📊 Распределение типов (топ-10):")
        for t, count in sorted(type_counts.items(), key=lambda x: x[1], reverse=True)[:10]:
            type_name = "муниципальное" if t == 0 else f"тип_{t}"
            print(f"   {type_name}: {count}")
        
        print(f"\n💡 Рекомендации:")
        print(f"   1. Размер {optimized_size/1024/1024:.1f} МБ приемлем для загрузки")
        print(f"   2. Можно добавить gzip сжатие на сервере")
        print(f"   3. Для ускорения загрузки можно разбить по регионам")
        
    except Exception as e:
        print(f"❌ Ошибка при сохранении файла: {e}")

def main():
    input_file = "oktmo.csv"
    output_file = "data.js"
    
    print("📁 Поиск файла ОКТМО...")
    
    import os
    if not os.path.exists(input_file):
        print(f"❌ Файл '{input_file}' не найден!")
        return
    
    file_size = os.path.getsize(input_file)
    print(f"✅ Файл найден: {input_file} ({file_size:,} байт)")
    
    convert_oktmo_csv_to_json(input_file, output_file)
    
    print("\n🎯 Следующие шаги:")
    print("1. Проверьте размер файла data.js")
    print("2. Создайте index.html с базовой структурой")
    print("3. Адаптируйте script.js из ОКВЭД2 для работы с новой структурой")

if __name__ == "__main__":
    main()