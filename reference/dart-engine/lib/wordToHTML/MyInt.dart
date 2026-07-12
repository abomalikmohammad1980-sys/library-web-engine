extension MyInt on int {
  twpsToPx() {
    return this * 0.0667;
  }

  twipsToDp() {
    return (this / 20) * 1.333;
  }

  emuToPx() {
    return this / 9525;
  }
}

extension MyDouble on double {
  twpsToPx() {
    return this * 0.0667;
  }

  twipsToDp() {
    return (this / 20) * 1.333;
  }

  emuToPx() {
    return this / 9525;
  }
}
