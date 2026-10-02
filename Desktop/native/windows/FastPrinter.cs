using System;
using System.IO;
using System.IO.Ports;
using System.Threading;

namespace FastPrinter
{
    class Program
    {
        static void Main(string[] args)
        {
            if (args.Length < 2)
            {
                Console.WriteLine("ERROR: Missing arguments.");
                Console.WriteLine("Usage: FastPrinter.exe <COM_PORT> <FILE_PATH>");
                Environment.Exit(1);
            }

            string comPort = args[0];
            string filePath = args[1];

            try
            {
                if (!File.Exists(filePath))
                {
                    Console.WriteLine("ERROR: File not found: " + filePath);
                    Environment.Exit(1);
                }

                byte[] printData = File.ReadAllBytes(filePath);

                using (SerialPort port = new SerialPort(comPort))
                {
                    port.BaudRate = 115200;
                    port.DataBits = 8;
                    port.Parity = Parity.None;
                    port.StopBits = StopBits.One;
                    port.Handshake = Handshake.None;
                    port.WriteTimeout = 5000;
                    port.ReadTimeout = 5000;

                    port.WriteBufferSize = 1048576; // 1 MB buffer

                    port.Open();

                    port.Write(printData, 0, printData.Length);
                    
                    Thread.Sleep(200);
                    port.Close();
                }

                Console.WriteLine("SUCCESS");
                Environment.Exit(0);
            }
            catch (Exception ex)
            {
                Console.WriteLine("ERROR: " + ex.Message);
                Environment.Exit(1);
            }
        }
    }
}
