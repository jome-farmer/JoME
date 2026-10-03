import { useNavigate } from "react-router-dom";
import {
  ChartColumn,
  Cpu,
  MessageCircle,
  Router,
  Terminal,
} from "lucide-react";
import { List, ListRow } from "../../ui/ListRow";
import { Screen } from "../../ui/Screen";

/** The fifth tab: everything that isn't the daily garden. */
export function MoreScreen() {
  const navigate = useNavigate();
  return (
    <Screen title="More">
      <List>
        <ListRow
          icon={MessageCircle}
          title="Ask JoME"
          subtitle="The assistant for plants, weather and this garden"
          onClick={() => navigate("/assistant")}
        />
        <ListRow
          icon={ChartColumn}
          title="Analytics"
          subtitle="Water, soil, nutrients and weather"
          onClick={() => navigate("/analytics")}
        />
        <ListRow
          icon={Cpu}
          title="Devices"
          subtitle="Controllers, sensors and equipment"
          onClick={() => navigate("/devices")}
        />
      </List>
      <List>
        <ListRow
          icon={Router}
          title="Controller settings"
          subtitle="Wi‑Fi, rain delay, appearance, account"
          onClick={() => navigate("/device")}
        />
        <ListRow
          icon={Terminal}
          title="Serial terminal"
          onClick={() => navigate("/device/terminal")}
        />
      </List>
    </Screen>
  );
}
