// Coverage-floor check for the Flutter app (team.md Q6/Q7; cicd-pipeline.md).
//
// Reads `coverage/lcov.info` (written by `flutter test --coverage`), prints the
// line-coverage percentage over `lib/`, and exits non-zero when it is below
// the floor. The default floor is the affirmed 80% and is NEVER lowered to make
// a run pass — a shortfall is surfaced, not hidden.
//
// Usage: dart run tool/check_coverage.dart [--min 80] [--file coverage/lcov.info]
//
// Excluded from the measurement (unit-test-instructions.md "Expected
// coverage"): nothing under lib/ is excluded. `integration_test/` and `tool/`
// never appear in lcov.info because `flutter test --coverage test/` only
// instruments code reached from `test/`.
import 'dart:io';

const int defaultMinimum = 80;

void main(List<String> args) {
  var minimum = defaultMinimum;
  var file = 'coverage/lcov.info';
  for (var i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--min':
        if (i + 1 >= args.length) {
          _fail('--min requires a value');
        }
        minimum = int.tryParse(args[++i]) ?? _fail('--min must be an integer');
      case '--file':
        if (i + 1 >= args.length) {
          _fail('--file requires a path');
        }
        file = args[++i];
      default:
        _fail('unknown argument: ${args[i]}');
    }
  }
  if (minimum < defaultMinimum) {
    // The affirmed floor is a lower bound on the argument too: the check may be
    // made stricter, never looser.
    _fail('--min $minimum is below the affirmed floor of $defaultMinimum%');
  }

  final lcov = File(file);
  if (!lcov.existsSync()) {
    _fail('$file not found — run `flutter test --coverage test/` first');
  }

  final summary = summarize(lcov.readAsLinesSync());
  final pct = summary.percentage;
  stdout.writeln(
    'Line coverage: ${pct.toStringAsFixed(2)}% '
    '(${summary.hit}/${summary.found} lines across ${summary.files} files)',
  );
  if (summary.found == 0) {
    _fail('no coverage data found in $file');
  }
  if (pct < minimum) {
    _fail('coverage ${pct.toStringAsFixed(2)}% is below the $minimum% floor');
  }
  stdout.writeln('Coverage floor of $minimum% met.');
}

/// Aggregated `LF:`/`LH:` totals from an lcov file.
class CoverageSummary {
  const CoverageSummary({
    required this.found,
    required this.hit,
    required this.files,
  });

  final int found;
  final int hit;
  final int files;

  double get percentage => found == 0 ? 0 : hit * 100 / found;
}

/// Sums `LF` (lines found) and `LH` (lines hit) records across every `SF`
/// section. Pure so it can be unit-tested without touching the filesystem.
CoverageSummary summarize(Iterable<String> lines) {
  var found = 0;
  var hit = 0;
  var files = 0;
  for (final raw in lines) {
    final line = raw.trim();
    if (line.startsWith('SF:')) {
      files++;
    } else if (line.startsWith('LF:')) {
      found += int.tryParse(line.substring(3)) ?? 0;
    } else if (line.startsWith('LH:')) {
      hit += int.tryParse(line.substring(3)) ?? 0;
    }
  }
  return CoverageSummary(found: found, hit: hit, files: files);
}

Never _fail(String message) {
  stderr.writeln('check_coverage: $message');
  exit(1);
}
