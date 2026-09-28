/// `ScreenState<T>` tests (plan Step 4.2).
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:sarovar_jinalaya/models/post.dart';
import 'package:sarovar_jinalaya/utils/screen_state.dart';

import '../support/fixtures.dart';

void main() {
  /// Renders a state to a tag string via `when`, so each test asserts which
  /// branch actually ran rather than that the call merely returned something.
  String describe(ScreenState<List<Post>> state) => state.when(
    loading: () => 'loading',
    loaded: (data) => 'loaded:${data.length}',
    empty: () => 'empty',
    error: (message) => 'error:$message',
  );

  test('when() dispatches to exactly the matching branch', () {
    expect(describe(const ScreenState<List<Post>>.loading()), 'loading');
    expect(describe(ScreenState<List<Post>>.loaded([aPost()])), 'loaded:1');
    expect(describe(const ScreenState<List<Post>>.empty()), 'empty');
    expect(
      describe(const ScreenState<List<Post>>.error('Network unavailable')),
      'error:Network unavailable',
    );
  });

  test('Loaded([]) is NOT Empty — screens decide emptiness explicitly', () {
    const loadedEmptyList = ScreenState<List<Post>>.loaded(<Post>[]);
    const empty = ScreenState<List<Post>>.empty();

    expect(loadedEmptyList, isNot(empty));
    expect(loadedEmptyList, isA<Loaded<List<Post>>>());
    expect(loadedEmptyList, isNot(isA<Empty<List<Post>>>()));
    // `when` still routes it to `loaded`, with a zero-length payload.
    expect(describe(loadedEmptyList), 'loaded:0');
  });

  test('isLoading / isError flag only their own state', () {
    const loading = ScreenState<int>.loading();
    const failure = ScreenState<int>.error('boom');
    const loaded = ScreenState<int>.loaded(1);

    expect(loading.isLoading, isTrue);
    expect(loading.isError, isFalse);
    expect(failure.isError, isTrue);
    expect(failure.isLoading, isFalse);
    expect(loaded.isLoading, isFalse);
    expect(loaded.isError, isFalse);
  });

  test('value equality holds per state and per payload', () {
    expect(const ScreenState<int>.loading(), const ScreenState<int>.loading());
    expect(const ScreenState<int>.empty(), const ScreenState<int>.empty());
    expect(const ScreenState<int>.loaded(3), const ScreenState<int>.loaded(3));
    expect(
      const ScreenState<int>.loaded(3),
      isNot(const ScreenState<int>.loaded(4)),
    );
    expect(
      const ScreenState<int>.error('a'),
      isNot(const ScreenState<int>.error('b')),
    );
    expect(
      const ScreenState<int>.loading(),
      isNot(const ScreenState<int>.empty()),
    );
    expect(
      const ScreenState<int>.loading().hashCode,
      const ScreenState<int>.loading().hashCode,
    );
  });
}
