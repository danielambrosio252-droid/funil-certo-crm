import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, addDays, setHours, setMinutes } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Clock, Send, Timer } from "lucide-react";
import { cn } from "@/lib/utils";

interface CampaignSchedulerProps {
  onScheduleChange: (schedule: ScheduleData) => void;
}

export interface ScheduleData {
  type: "now" | "scheduled";
  scheduledAt: Date | null;
}

const timeSlots = [
  "06:00", "06:30", "07:00", "07:30", "08:00", "08:30", 
  "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "12:00", "12:30", "13:00", "13:30", "14:00", "14:30",
  "15:00", "15:30", "16:00", "16:30", "17:00", "17:30",
  "18:00", "18:30", "19:00", "19:30", "20:00", "20:30",
  "21:00", "21:30", "22:00",
];

export function CampaignScheduler({ onScheduleChange }: CampaignSchedulerProps) {
  const [scheduleType, setScheduleType] = useState<"now" | "scheduled">("now");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(addDays(new Date(), 1));
  const [selectedTime, setSelectedTime] = useState("09:00");

  const handleScheduleTypeChange = (type: "now" | "scheduled") => {
    setScheduleType(type);
    if (type === "now") {
      onScheduleChange({ type: "now", scheduledAt: null });
    } else if (selectedDate) {
      updateScheduledTime(selectedDate, selectedTime);
    }
  };

  const updateScheduledTime = (date: Date, time: string) => {
    const [hours, minutes] = time.split(":").map(Number);
    const scheduledDate = setMinutes(setHours(date, hours), minutes);
    onScheduleChange({ type: "scheduled", scheduledAt: scheduledDate });
  };

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    if (date && scheduleType === "scheduled") {
      updateScheduledTime(date, selectedTime);
    }
  };

  const handleTimeChange = (time: string) => {
    setSelectedTime(time);
    if (selectedDate && scheduleType === "scheduled") {
      updateScheduledTime(selectedDate, time);
    }
  };

  return (
    <div className="space-y-4">
      <RadioGroup value={scheduleType} onValueChange={(v) => handleScheduleTypeChange(v as "now" | "scheduled")} className="space-y-3">
        <Label htmlFor="now" className="cursor-pointer">
          <Card className={cn(
            "transition-all hover:border-primary",
            scheduleType === "now" && "border-primary bg-primary/5"
          )}>
            <CardContent className="p-4 flex items-center gap-4">
              <RadioGroupItem value="now" id="now" />
              <div className="p-2 rounded-lg bg-primary/10">
                <Send className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Enviar Agora</p>
                <p className="text-sm text-muted-foreground">
                  A campanha será enviada imediatamente após a criação
                </p>
              </div>
            </CardContent>
          </Card>
        </Label>

        <Label htmlFor="scheduled" className="cursor-pointer">
          <Card className={cn(
            "transition-all hover:border-primary",
            scheduleType === "scheduled" && "border-primary bg-primary/5"
          )}>
            <CardContent className="p-4 flex items-center gap-4">
              <RadioGroupItem value="scheduled" id="scheduled" />
              <div className="p-2 rounded-lg bg-primary/10">
                <Timer className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Agendar Envio</p>
                <p className="text-sm text-muted-foreground">
                  Escolha uma data e hora para o envio automático
                </p>
              </div>
            </CardContent>
          </Card>
        </Label>
      </RadioGroup>

      {scheduleType === "scheduled" && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data do Envio</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !selectedDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {selectedDate ? (
                        format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
                      ) : (
                        "Selecione uma data"
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={handleDateSelect}
                      disabled={(date) => date < new Date()}
                      initialFocus
                      locale={ptBR}
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Hora do Envio</Label>
                <Select value={selectedTime} onValueChange={handleTimeChange}>
                  <SelectTrigger>
                    <Clock className="mr-2 h-4 w-4" />
                    <SelectValue placeholder="Selecione o horário" />
                  </SelectTrigger>
                  <SelectContent>
                    {timeSlots.map((time) => (
                      <SelectItem key={time} value={time}>
                        {time}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {selectedDate && (
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                <p className="text-sm">
                  <strong>Envio agendado para:</strong>{" "}
                  {format(
                    setMinutes(setHours(selectedDate, parseInt(selectedTime.split(":")[0])), parseInt(selectedTime.split(":")[1])),
                    "EEEE, dd 'de' MMMM 'de' yyyy 'às' HH:mm",
                    { locale: ptBR }
                  )}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
