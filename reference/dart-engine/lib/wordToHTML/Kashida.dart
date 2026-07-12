


import 'package:flutter/material.dart';

String kashidaLetters ="ضصثقفغعهخحجطكمنتلبيسشظئى";
String lowKashida = "ـ";
String midiumKashida = "ــ";
String HighKashida = "ـــ";
bool isKashidaLetter (String letter){
  return kashidaLetters.contains(letter);
}
addKashida(String text){
  if(text.length<10) return text;
  int kashidaNumber = (text.length/4).toInt();
  kashidaNumber=15;
  int j =0;
  List<String> letters = text.characters.toList();
  String newText="";
  for(int i=0;i<letters.length-1;i++){
    newText =newText +letters[i];
    if(j<=kashidaNumber&&isKashidaLetter(letters[i])&&isKashidaLetter(letters[i+1])){
      newText=newText+lowKashida;
      j++;
    }
  }
  newText =newText+letters[letters.length-1];
  return newText;
}
