import 'package:json_annotation/json_annotation.dart';

part 'TabStop.g.dart';

/// Represents a custom tab stop in a Word paragraph.
/// 
/// Tab stops define positions where text aligns when a tab character is encountered.
/// They can have different alignment types and leader characters.
@JsonSerializable()
class TabStop {
  /// Tab stop type/alignment:
  /// - start/left: Left-aligned tab
  /// - center: Center-aligned tab
  /// - right/end: Right-aligned tab (common for page numbers)
  /// - bar: Vertical bar at position
  /// - clear: Removes tab stop at this position
  String? type;
  
  /// Position in twips (1/20 of a point, or 1/1440 of an inch)
  /// Will be converted to pixels for rendering
  double? position;
  
  /// Leader character to fill the space before the tab:
  /// - dot: Dots (.......)
  /// - underscore: Underscores (_______)
  /// - hyphen: Hyphens (-------)
  /// - middleDot: Middle dots (·······)
  /// - heavy: Heavy dots
  /// - none: No leader (default)
  String? leader;
  
  TabStop({this.type, this.position, this.leader});
  
  factory TabStop.fromJson(Map<String, dynamic> json) => _$TabStopFromJson(json);
  Map<String, dynamic> toJson() => _$TabStopToJson(this);
  
  /// Convert twips position to pixels
  /// 1 twip = 1/20 point = 1/1440 inch
  /// At 96 DPI: 1 twip = 96/1440 ≈ 0.0667 pixels
  double get positionInPx => (position ?? 0) * 0.0667;
  
  /// Check if this is a right-aligned tab (typically used for page numbers)
  bool get isRightAligned => type == 'right' || type == 'end';
  
  /// Check if this tab has a leader character
  bool get hasLeader => leader != null && leader != 'none' && leader!.isNotEmpty;
  
  /// Get the leader character to use for filling
  String get leaderChar {
    switch (leader) {
      case 'dot':
        return '.';
      case 'underscore':
        return '_';
      case 'hyphen':
        return '-';
      case 'middleDot':
        return '·';
      case 'heavy':
        return '●';
      default:
        return '';
    }
  }
}
