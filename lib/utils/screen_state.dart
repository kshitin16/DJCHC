/// The per-screen state union every screen's `ValueNotifier` holds
/// (frontend-components.md): `Loading | Loaded(T) | Empty | Error(message)`.
///
/// `Loaded([])` is deliberately NOT `Empty` — each screen decides emptiness
/// explicitly so the empty copy stays per-screen.
library;

import 'package:flutter/foundation.dart';

@immutable
sealed class ScreenState<T> {
  const ScreenState();

  const factory ScreenState.loading() = Loading<T>;
  const factory ScreenState.loaded(T data) = Loaded<T>;
  const factory ScreenState.empty() = Empty<T>;
  const factory ScreenState.error(String message) = Failure<T>;

  R when<R>({
    required R Function() loading,
    required R Function(T data) loaded,
    required R Function() empty,
    required R Function(String message) error,
  }) {
    final self = this;
    return switch (self) {
      Loading<T>() => loading(),
      Loaded<T>(data: final d) => loaded(d),
      Empty<T>() => empty(),
      Failure<T>(message: final m) => error(m),
    };
  }

  bool get isLoading => this is Loading<T>;
  bool get isError => this is Failure<T>;
}

final class Loading<T> extends ScreenState<T> {
  const Loading();

  @override
  bool operator ==(Object other) => other is Loading<T>;

  @override
  int get hashCode => (Loading).hashCode;
}

final class Loaded<T> extends ScreenState<T> {
  const Loaded(this.data);
  final T data;

  @override
  bool operator ==(Object other) => other is Loaded<T> && other.data == data;

  @override
  int get hashCode => Object.hash(Loaded, data);
}

final class Empty<T> extends ScreenState<T> {
  const Empty();

  @override
  bool operator ==(Object other) => other is Empty<T>;

  @override
  int get hashCode => (Empty).hashCode;
}

/// Named `Failure` rather than `Error` to avoid shadowing `dart:core`'s `Error`
/// and the `ErrorState` widget.
final class Failure<T> extends ScreenState<T> {
  const Failure(this.message);
  final String message;

  @override
  bool operator ==(Object other) =>
      other is Failure<T> && other.message == message;

  @override
  int get hashCode => Object.hash(Failure, message);
}
