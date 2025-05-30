package com.example.app;

import com.getcapacitor.BridgeActivity;
import com.example.app.PedometerPlugin;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(android.os.Bundle savedInstanceState) {
    registerPlugin(PedometerPlugin.class);
    super.onCreate(savedInstanceState);
  }
}
