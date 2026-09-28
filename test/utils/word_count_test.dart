/// `word_count` tests (plan Step 8.4) — the advisory suggestion counter (BR3.1).
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:sarovar_jinalaya/utils/word_count.dart';

void main() {
  test('counts words by whitespace runs', () {
    expect(countWords('hello world'), 2);
    expect(countWords('one two three four five'), 5);
    // Repeated, mixed and leading/trailing whitespace collapses.
    expect(countWords('hello    world'), 2);
    expect(countWords('  hello\tworld\n'), 2);
    expect(countWords('line one\nline two'), 4);
  });

  test('empty and whitespace-only text counts zero', () {
    expect(countWords(''), 0);
    expect(countWords('   '), 0);
    expect(countWords('\n\t  \n'), 0);
  });

  test('punctuation does not split or inflate a word', () {
    expect(countWords('hello, world!'), 2);
    expect(countWords("don't stop"), 2);
    expect(countWords('well-known temple'), 2);
    expect(countWords('...'), 1);
    expect(countWords('Rs. 501/- donated'), 3);
  });

  test('Devanagari counts by whitespace, exactly as the server does', () {
    expect(countWords('मंदिर में शाम की आरती'), 5);
    expect(countWords('कृपया  पार्किंग  बढ़ाएँ'), 3);
    // Mixed scripts in one suggestion.
    expect(countWords('temple में parking'), 3);
  });

  test('the warning fires near the limit but nothing is ever blocked', () {
    expect(suggestionWordLimit, 300);
    expect(suggestionWarnAt, 280);

    expect(isNearWordLimit(279), isFalse);
    expect(isNearWordLimit(280), isTrue);
    expect(isNearWordLimit(300), isTrue);

    expect(
      isOverWordLimit(300),
      isFalse,
      reason: 'the limit itself is allowed',
    );
    expect(isOverWordLimit(301), isTrue);

    // A real 342-word suggestion: warned and over, but still countable — the
    // form submits it and lets the server refuse (frontend-components.md).
    final long = List.filled(342, 'शब्द').join(' ');
    expect(countWords(long), 342);
    expect(isNearWordLimit(countWords(long)), isTrue);
    expect(isOverWordLimit(countWords(long)), isTrue);
  });
}
